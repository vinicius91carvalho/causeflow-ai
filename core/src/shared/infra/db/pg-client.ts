/**
 * Postgres connection pool for the open-source local runtime (AC-040).
 *
 * Provides a singleton `Pool` (via `pg`) configured from `config.postgres`.
 * Use `getPgPool()` to obtain the pool and `closePgPool()` during graceful
 * shutdown. Created only in the OSS runtime — the AWS runtime never imports
 * this module (no `pg` dependency).
 */
import { config } from '../../config/index.js';
import { logger } from '../logger.js';

let pool: { query: (...args: unknown[]) => Promise<unknown>; end: () => Promise<void> } | null =
  null;

export interface PgPool {
  query(text: string, params?: unknown[]): Promise<{ rows: unknown[]; rowCount: number | null }>;
  end(): Promise<void>;
}

/**
 * Get or create the singleton Postgres pool.
 * Returns null if called outside the OSS runtime (no pg dep).
 */
export async function getPgPool(): Promise<PgPool> {
  if (pool) return pool as unknown as PgPool;

  if (!config.isOss()) {
    throw new Error('Postgres pool is only available in OSS runtime');
  }

  const { default: pg } = await import('pg');

  const p = new pg.Pool({
    connectionString: config.postgres.url,
    host: config.postgres.host,
    port: config.postgres.port,
    database: config.postgres.database,
    user: config.postgres.user ?? undefined,
    password: config.postgres.password ?? undefined,
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
  });

  // Log pool errors without crashing
  p.on('error', (err: Error) => {
    logger.error({ err }, 'Postgres pool error');
  });

  pool = p;
  return p as unknown as PgPool;
}

export async function closePgPool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
    logger.info('Postgres pool closed');
  }
}

/**
 * Run schema migrations against the causeflow-postgres database.
 * Called during OSS boot in main.ts.
 */
export async function runPgMigrations(): Promise<void> {
  const db = await getPgPool();
  logger.info('Running Postgres schema migrations...');

  // Run the migration SQL
  const migrationSql = getMigrationSql();
  const statements = migrationSql
    .split(';')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  for (const stmt of statements) {
    try {
      await db.query(stmt + ';');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      // Ignore "already exists" errors for idempotency
      if (msg.includes('already exists')) {
        logger.debug('Migration statement skipped (already exists)');
      } else {
        logger.error({ err, statement: stmt.substring(0, 80) }, 'Migration statement failed');
        throw err;
      }
    }
  }

  logger.info('Postgres schema migrations complete');
}

function getMigrationSql(): string {
  // NOTE: In production this would read from a .sql file.
  // For now we embed the schema DDL inline for simplicity.
  return `
CREATE SCHEMA IF NOT EXISTS causeflow;

CREATE TABLE IF NOT EXISTS causeflow.tenants (tenant_id TEXT NOT NULL, entity_id TEXT NOT NULL DEFAULT 'tenant', data JSONB NOT NULL DEFAULT '{}', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), PRIMARY KEY (tenant_id, entity_id));
CREATE TABLE IF NOT EXISTS causeflow.users (tenant_id TEXT NOT NULL, entity_id TEXT NOT NULL, data JSONB NOT NULL DEFAULT '{}', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), PRIMARY KEY (tenant_id, entity_id));
CREATE TABLE IF NOT EXISTS causeflow.incidents (tenant_id TEXT NOT NULL, entity_id TEXT NOT NULL, data JSONB NOT NULL DEFAULT '{}', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), PRIMARY KEY (tenant_id, entity_id));
CREATE TABLE IF NOT EXISTS causeflow.integrations (tenant_id TEXT NOT NULL, entity_id TEXT NOT NULL, data JSONB NOT NULL DEFAULT '{}', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), PRIMARY KEY (tenant_id, entity_id));
CREATE TABLE IF NOT EXISTS causeflow.evidence (tenant_id TEXT NOT NULL, entity_id TEXT NOT NULL, data JSONB NOT NULL DEFAULT '{}', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), PRIMARY KEY (tenant_id, entity_id));
CREATE TABLE IF NOT EXISTS causeflow.audit_entries (tenant_id TEXT NOT NULL, entity_id TEXT NOT NULL, data JSONB NOT NULL DEFAULT '{}', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), PRIMARY KEY (tenant_id, entity_id));
CREATE TABLE IF NOT EXISTS causeflow.remediation (tenant_id TEXT NOT NULL, entity_id TEXT NOT NULL, data JSONB NOT NULL DEFAULT '{}', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), PRIMARY KEY (tenant_id, entity_id));
CREATE TABLE IF NOT EXISTS causeflow.patterns (tenant_id TEXT NOT NULL, entity_id TEXT NOT NULL, data JSONB NOT NULL DEFAULT '{}', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), PRIMARY KEY (tenant_id, entity_id));
CREATE TABLE IF NOT EXISTS causeflow.feedback (tenant_id TEXT NOT NULL, entity_id TEXT NOT NULL, data JSONB NOT NULL DEFAULT '{}', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), PRIMARY KEY (tenant_id, entity_id));
CREATE TABLE IF NOT EXISTS causeflow.service_nodes (tenant_id TEXT NOT NULL, entity_id TEXT NOT NULL, data JSONB NOT NULL DEFAULT '{}', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), PRIMARY KEY (tenant_id, entity_id));
CREATE TABLE IF NOT EXISTS causeflow.service_edges (tenant_id TEXT NOT NULL, entity_id TEXT NOT NULL, data JSONB NOT NULL DEFAULT '{}', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), PRIMARY KEY (tenant_id, entity_id));
CREATE TABLE IF NOT EXISTS causeflow.change_events (tenant_id TEXT NOT NULL, entity_id TEXT NOT NULL, data JSONB NOT NULL DEFAULT '{}', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), PRIMARY KEY (tenant_id, entity_id));
CREATE TABLE IF NOT EXISTS causeflow.notifications (tenant_id TEXT NOT NULL, entity_id TEXT NOT NULL, data JSONB NOT NULL DEFAULT '{}', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), PRIMARY KEY (tenant_id, entity_id));
CREATE TABLE IF NOT EXISTS causeflow.approvals (tenant_id TEXT NOT NULL, entity_id TEXT NOT NULL, data JSONB NOT NULL DEFAULT '{}', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), PRIMARY KEY (tenant_id, entity_id));
CREATE TABLE IF NOT EXISTS causeflow.api_keys (tenant_id TEXT NOT NULL, entity_id TEXT NOT NULL, data JSONB NOT NULL DEFAULT '{}', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), PRIMARY KEY (tenant_id, entity_id));
CREATE TABLE IF NOT EXISTS causeflow.repo_nodes (tenant_id TEXT NOT NULL, entity_id TEXT NOT NULL, data JSONB NOT NULL DEFAULT '{}', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), PRIMARY KEY (tenant_id, entity_id));
CREATE TABLE IF NOT EXISTS causeflow.package_dependencies (tenant_id TEXT NOT NULL, entity_id TEXT NOT NULL, data JSONB NOT NULL DEFAULT '{}', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), PRIMARY KEY (tenant_id, entity_id));
CREATE TABLE IF NOT EXISTS causeflow.repo_service_maps (tenant_id TEXT NOT NULL, entity_id TEXT NOT NULL, data JSONB NOT NULL DEFAULT '{}', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), PRIMARY KEY (tenant_id, entity_id));
CREATE TABLE IF NOT EXISTS causeflow.billing_accounts (tenant_id TEXT NOT NULL, entity_id TEXT NOT NULL, data JSONB NOT NULL DEFAULT '{}', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), PRIMARY KEY (tenant_id, entity_id));
CREATE TABLE IF NOT EXISTS causeflow.usage_records (tenant_id TEXT NOT NULL, entity_id TEXT NOT NULL, data JSONB NOT NULL DEFAULT '{}', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), PRIMARY KEY (tenant_id, entity_id));
CREATE TABLE IF NOT EXISTS causeflow.triggers (tenant_id TEXT NOT NULL, entity_id TEXT NOT NULL, data JSONB NOT NULL DEFAULT '{}', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), PRIMARY KEY (tenant_id, entity_id));
CREATE TABLE IF NOT EXISTS causeflow.widget_sessions (tenant_id TEXT NOT NULL, entity_id TEXT NOT NULL, data JSONB NOT NULL DEFAULT '{}', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), PRIMARY KEY (tenant_id, entity_id));
CREATE TABLE IF NOT EXISTS causeflow.chat_messages (tenant_id TEXT NOT NULL, entity_id TEXT NOT NULL, data JSONB NOT NULL DEFAULT '{}', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), PRIMARY KEY (tenant_id, entity_id));
CREATE TABLE IF NOT EXISTS causeflow.tool_calls (tenant_id TEXT NOT NULL, entity_id TEXT NOT NULL, data JSONB NOT NULL DEFAULT '{}', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), PRIMARY KEY (tenant_id, entity_id));
CREATE TABLE IF NOT EXISTS causeflow.invites (tenant_id TEXT NOT NULL, entity_id TEXT NOT NULL, data JSONB NOT NULL DEFAULT '{}', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), PRIMARY KEY (tenant_id, entity_id));
CREATE TABLE IF NOT EXISTS causeflow.user_settings (tenant_id TEXT NOT NULL, entity_id TEXT NOT NULL, data JSONB NOT NULL DEFAULT '{}', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), PRIMARY KEY (tenant_id, entity_id));
CREATE TABLE IF NOT EXISTS causeflow.slack_notifications (tenant_id TEXT NOT NULL, entity_id TEXT NOT NULL, data JSONB NOT NULL DEFAULT '{}', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), PRIMARY KEY (tenant_id, entity_id));
CREATE TABLE IF NOT EXISTS causeflow.push_subscriptions (tenant_id TEXT NOT NULL, entity_id TEXT NOT NULL, data JSONB NOT NULL DEFAULT '{}', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), PRIMARY KEY (tenant_id, entity_id));
CREATE TABLE IF NOT EXISTS causeflow.slack_oauth_states (tenant_id TEXT NOT NULL, entity_id TEXT NOT NULL, data JSONB NOT NULL DEFAULT '{}', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), PRIMARY KEY (tenant_id, entity_id));
CREATE TABLE IF NOT EXISTS causeflow.oauth_tokens (tenant_id TEXT NOT NULL, entity_id TEXT NOT NULL, data JSONB NOT NULL DEFAULT '{}', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), PRIMARY KEY (tenant_id, entity_id));
CREATE TABLE IF NOT EXISTS causeflow.hypotheses (tenant_id TEXT NOT NULL, entity_id TEXT NOT NULL, data JSONB NOT NULL DEFAULT '{}', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), PRIMARY KEY (tenant_id, entity_id));
CREATE TABLE IF NOT EXISTS causeflow.runbook_registry (tenant_id TEXT NOT NULL, entity_id TEXT NOT NULL, data JSONB NOT NULL DEFAULT '{}', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), PRIMARY KEY (tenant_id, entity_id));
CREATE TABLE IF NOT EXISTS causeflow.investigation_llm_profiles (tenant_id TEXT NOT NULL, entity_id TEXT NOT NULL, data JSONB NOT NULL DEFAULT '{}', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), PRIMARY KEY (tenant_id, entity_id));

CREATE INDEX IF NOT EXISTS idx_incidents_created_at ON causeflow.incidents (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_entries_created_at ON causeflow.audit_entries (created_at DESC);
`;
}
