/**
 * Generic Postgres JSONB storage utilities for the OSS runtime (AC-040).
 */
import { getPgPool, type PgPool } from '../pg-client.js';

export interface PgEntityRow {
  tenant_id: string;
  entity_id: string;
  data: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

/**
 * Insert a new entity row.
 */
export async function pgInsert(
  table: string,
  tenantId: string,
  entityId: string,
  data: Record<string, unknown> | undefined,
): Promise<PgEntityRow> {
  const db = await getPgPool();
  const now = new Date().toISOString();
  const result = await db.query(
    `INSERT INTO causeflow.${table} (tenant_id, entity_id, data, created_at, updated_at)
         VALUES ($1, $2, $3::jsonb, $4, $5)
         RETURNING tenant_id, entity_id, data, created_at, updated_at`,
    [tenantId, entityId, JSON.stringify(data ?? {}), now, now],
  );
  return parseRow((result.rows as Array<Record<string, unknown>>)[0]!);
}

/**
 * Get a single entity by tenant + entity ID.
 */
export async function pgGet(
  table: string,
  tenantId: string,
  entityId: string,
): Promise<PgEntityRow | null> {
  const db = await getPgPool();
  const result = await db.query(
    `SELECT tenant_id, entity_id, data, created_at, updated_at
         FROM causeflow.${table}
         WHERE tenant_id = $1 AND entity_id = $2`,
    [tenantId, entityId],
  );
  if (!result.rowCount || result.rowCount === 0) return null;
  return parseRow((result.rows as Array<Record<string, unknown>>)[0]!);
}

/**
 * Update an entity's data (merges into existing JSONB).
 */
export async function pgUpdate(
  table: string,
  tenantId: string,
  entityId: string,
  data: Record<string, unknown> | undefined,
): Promise<PgEntityRow> {
  const db = await getPgPool();
  const now = new Date().toISOString();
  const result = await db.query(
    `UPDATE causeflow.${table}
         SET data = data || $3::jsonb, updated_at = $4
         WHERE tenant_id = $1 AND entity_id = $2
         RETURNING tenant_id, entity_id, data, created_at, updated_at`,
    [tenantId, entityId, JSON.stringify(data ?? {}), now],
  );
  if (!result.rowCount || result.rowCount === 0) {
    throw new Error(`Entity not found: ${table} ${tenantId}/${entityId}`);
  }
  return parseRow((result.rows as Array<Record<string, unknown>>)[0]!);
}

/**
 * Delete an entity row.
 */
export async function pgDelete(table: string, tenantId: string, entityId: string): Promise<void> {
  const db = await getPgPool();
  await db.query(
    `DELETE FROM causeflow.${table}
         WHERE tenant_id = $1 AND entity_id = $2`,
    [tenantId, entityId],
  );
}

/**
 * Query entities with a SQL WHERE clause and optional ORDER BY / LIMIT / OFFSET.
 */
export async function pgQuery(
  table: string,
  whereClause: string,
  params: unknown[],
  options?: { orderBy?: string; limit?: number; offset?: number },
): Promise<PgEntityRow[]> {
  const db = await getPgPool();
  let sql = `SELECT tenant_id, entity_id, data, created_at, updated_at FROM causeflow.${table} WHERE ${whereClause}`;
  if (options?.orderBy) sql += ` ORDER BY ${options.orderBy}`;
  if (options?.limit) sql += ` LIMIT ${options.limit}`;
  if (options?.offset) sql += ` OFFSET ${options.offset}`;
  const result = await db.query(sql, params);
  if (!result.rowCount) return [];
  return (result.rows as Array<Record<string, unknown>>).map(parseRow);
}

/**
 * Query entities by a JSONB path filter.
 */
export async function pgQueryJson(
  table: string,
  jsonCondition: string,
  params: unknown[],
  options?: { orderBy?: string; limit?: number; offset?: number },
): Promise<PgEntityRow[]> {
  const db = await getPgPool();
  let sql = `SELECT tenant_id, entity_id, data, created_at, updated_at FROM causeflow.${table} WHERE ${jsonCondition}`;
  if (options?.orderBy) sql += ` ORDER BY ${options.orderBy}`;
  if (options?.limit) sql += ` LIMIT ${options.limit}`;
  if (options?.offset) sql += ` OFFSET ${options.offset}`;
  const result = await db.query(sql, params);
  if (!result.rowCount) return [];
  return (result.rows as Array<Record<string, unknown>>).map(parseRow);
}

function parseRow(r: Record<string, unknown>): PgEntityRow {
  const rawData = r['data'];
  let data: Record<string, unknown> = {};
  if (typeof rawData === 'string') {
    try {
      data = JSON.parse(rawData);
    } catch {
      data = {};
    }
  } else if (rawData && typeof rawData === 'object') {
    data = rawData as Record<string, unknown>;
  }
  return {
    tenant_id: String(r['tenant_id'] ?? ''),
    entity_id: String(r['entity_id'] ?? ''),
    data,
    created_at: String(r['created_at'] ?? ''),
    updated_at: String(r['updated_at'] ?? ''),
  };
}
