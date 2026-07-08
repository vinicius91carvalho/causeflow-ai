import sqlParser from 'node-sql-parser';
const { Parser } = sqlParser;

const parser = new Parser();

const DANGEROUS_FUNCTIONS = [
  'pg_sleep', 'lo_import', 'lo_export', 'pg_read_file', 'pg_write_file',
  'pg_ls_dir', 'pg_stat_file', 'pg_read_binary_file', 'pg_terminate_backend',
  'pg_cancel_backend', 'pg_reload_conf', 'set_config', 'current_setting',
  'dblink', 'dblink_exec',
];

export interface ParseResult {
  valid: boolean;
  reason?: string;
}

export function validateQuery(sql: string): ParseResult {
  const trimmed = sql.trim();

  // Multi-statement rejection
  if (trimmed.includes(';') && trimmed.indexOf(';') < trimmed.length - 1) {
    return { valid: false, reason: 'Multi-statement queries are not allowed' };
  }

  // Remove trailing semicolon for parsing
  const cleaned = trimmed.replace(/;$/, '');

  try {
    const ast = parser.astify(cleaned, { database: 'PostgresQL' });

    const statements = Array.isArray(ast) ? ast : [ast];

    if (statements.length > 1) {
      return { valid: false, reason: 'Multi-statement queries are not allowed' };
    }

    const stmt = statements[0]!;

    // Only allow SELECT statements
    if (stmt.type !== 'select') {
      return { valid: false, reason: `Only SELECT statements are allowed, got ${stmt.type?.toUpperCase()}` };
    }

    // Check for dangerous functions in the SQL text
    const lowerSql = cleaned.toLowerCase();
    for (const fn of DANGEROUS_FUNCTIONS) {
      if (lowerSql.includes(fn)) {
        return { valid: false, reason: `Dangerous function detected: ${fn}` };
      }
    }

    return { valid: true };
  } catch {
    // If parser fails, do basic string checks
    const upper = cleaned.toUpperCase().trim();
    const firstWord = upper.split(/\s+/)[0];

    const ddlDml = ['INSERT', 'UPDATE', 'DELETE', 'DROP', 'ALTER', 'CREATE', 'TRUNCATE', 'GRANT', 'REVOKE', 'COPY'];
    if (ddlDml.includes(firstWord ?? '')) {
      return { valid: false, reason: `${firstWord} statements are not allowed` };
    }

    if (firstWord === 'SELECT' || firstWord === 'WITH' || firstWord === 'EXPLAIN') {
      return { valid: true };
    }

    return { valid: false, reason: 'Unable to parse query — only SELECT is allowed' };
  }
}
