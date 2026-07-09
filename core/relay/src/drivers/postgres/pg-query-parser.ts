import pkg from 'node-sql-parser';
const { Parser } = pkg;

const parser = new Parser();

const DANGEROUS_FUNCTIONS = new Set<string>([
  'pg_sleep',
  'lo_import',
  'lo_export',
  'pg_read_file',
  'pg_write_file',
  'pg_ls_dir',
  'pg_stat_file',
  'pg_read_binary_file',
  'pg_terminate_backend',
  'pg_cancel_backend',
  'pg_reload_conf',
  'set_config',
  'current_setting',
  'dblink',
  'dblink_exec',
  'dblink_connect',
  'pg_read_server_files',
  'pg_write_server_files',
  'copy_from_program',
]);

const ALLOWED_STATEMENT_TYPES = new Set<string>(['select']);

const DDL_DML_FIRST_WORDS = new Set<string>([
  'INSERT',
  'UPDATE',
  'DELETE',
  'DROP',
  'ALTER',
  'CREATE',
  'TRUNCATE',
  'GRANT',
  'REVOKE',
  'COPY',
  'CALL',
  'DO',
  'MERGE',
  'LOCK',
  'VACUUM',
  'ANALYZE',
  'CLUSTER',
  'REINDEX',
  'COMMENT',
]);

export interface ParseResult {
  valid: boolean;
  reason?: string;
  statementType?: string;
}

function walkAst(node: unknown, onNode: (node: Record<string, unknown>) => void): void {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) {
    for (const item of node) walkAst(item, onNode);
    return;
  }
  const obj = node as Record<string, unknown>;
  onNode(obj);
  for (const value of Object.values(obj)) {
    if (value && typeof value === 'object') walkAst(value, onNode);
  }
}

function collectFunctionCalls(ast: unknown): string[] {
  const calls: string[] = [];
  walkAst(ast, (node) => {
    const type = node['type'];
    if (type === 'function' || type === 'aggr_func') {
      const nameField = node['name'];
      if (typeof nameField === 'string') {
        calls.push(nameField.toLowerCase());
      } else if (nameField && typeof nameField === 'object') {
        const inner = (nameField as Record<string, unknown>)['name'];
        if (Array.isArray(inner)) {
          for (const part of inner) {
            if (part && typeof part === 'object') {
              const value = (part as Record<string, unknown>)['value'];
              if (typeof value === 'string') calls.push(value.toLowerCase());
            }
          }
        } else if (typeof inner === 'string') {
          calls.push(inner.toLowerCase());
        }
      }
    }
  });
  return calls;
}

export function validateQuery(sql: string): ParseResult {
  const trimmed = sql.trim();
  if (!trimmed) return { valid: false, reason: 'Empty query' };

  const cleaned = trimmed.replace(/;\s*$/, '');

  let ast: unknown;
  try {
    ast = parser.astify(cleaned, { database: 'PostgresQL' });
  } catch {
    return fallbackValidate(cleaned);
  }

  const statements = Array.isArray(ast) ? ast : [ast];
  if (statements.length > 1) {
    return { valid: false, reason: 'Multi-statement queries are not allowed' };
  }

  const stmt = statements[0] as Record<string, unknown> | undefined;
  if (!stmt) return { valid: false, reason: 'Failed to parse query' };

  const statementType = typeof stmt['type'] === 'string' ? (stmt['type'] as string).toLowerCase() : 'unknown';

  if (!ALLOWED_STATEMENT_TYPES.has(statementType)) {
    return {
      valid: false,
      reason: `Only SELECT statements are allowed, got ${statementType.toUpperCase()}`,
      statementType,
    };
  }

  const functionCalls = collectFunctionCalls(stmt);
  for (const fn of functionCalls) {
    if (DANGEROUS_FUNCTIONS.has(fn)) {
      return { valid: false, reason: `Dangerous function detected: ${fn}`, statementType };
    }
  }

  return { valid: true, statementType };
}

function fallbackValidate(cleaned: string): ParseResult {
  const withoutStringLiterals = cleaned
    .replace(/'(?:''|[^'])*'/g, "''")
    .replace(/\$\$[\s\S]*?\$\$/g, '$$$$');

  if (/;/.test(withoutStringLiterals)) {
    return { valid: false, reason: 'Multi-statement queries are not allowed' };
  }

  const upper = withoutStringLiterals.toUpperCase().trim();
  const firstWord = upper.split(/\s+/)[0] ?? '';

  if (DDL_DML_FIRST_WORDS.has(firstWord)) {
    return { valid: false, reason: `${firstWord} statements are not allowed` };
  }

  if (firstWord !== 'SELECT' && firstWord !== 'WITH' && firstWord !== 'EXPLAIN') {
    return { valid: false, reason: 'Unable to parse query — only SELECT is allowed' };
  }

  const lower = withoutStringLiterals.toLowerCase();
  for (const fn of DANGEROUS_FUNCTIONS) {
    const pattern = new RegExp(`\\b${fn.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\(`, 'i');
    if (pattern.test(lower)) {
      return { valid: false, reason: `Dangerous function detected: ${fn}` };
    }
  }

  return { valid: true, statementType: firstWord.toLowerCase() };
}
