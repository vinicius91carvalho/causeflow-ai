/**
 * Postgres integration test for the OSS runtime (replaces DynamoDB integration).
 *
 * Verifies that the causeflow schema tables are accessible, and that the basic
 * CRUD patterns the repositories use (JSONB data storage, tenant-scoped queries,
 * composite PK (tenant_id, entity_id)) work correctly against Postgres.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getPgPool, waitForPostgres, closeConnections } from './setup.js';
import type { Pool } from 'pg';
import { v4 as uuid } from 'uuid';

describe('Postgres Integration (OSS runtime)', () => {
  let pool: Pool;
  const testTenantId = `test-tenant-${uuid()}`;

  beforeAll(async () => {
    pool = getPgPool();
    await waitForPostgres();
  });

  afterAll(async () => {
    // Clean up test data
    await pool
      .query(`DELETE FROM causeflow.incidents WHERE tenant_id = $1`, [testTenantId])
      .catch(() => {});
    await pool
      .query(`DELETE FROM causeflow.tenants WHERE tenant_id = $1`, [testTenantId])
      .catch(() => {});
    await closeConnections();
  });

  it('should have the causeflow schema with 31 tables', async () => {
    const result = await pool.query(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema = 'causeflow'
       ORDER BY table_name`,
    );
    expect(result.rows.length).toBeGreaterThanOrEqual(31);
    // Verify some key tables exist
    const tableNames = result.rows.map((r: { table_name: string }) => r.table_name);
    expect(tableNames).toContain('incidents');
    expect(tableNames).toContain('tenants');
    expect(tableNames).toContain('users');
    expect(tableNames).toContain('audit_entries');
    expect(tableNames).toContain('evidence');
    expect(tableNames).toContain('hypotheses');
  });

  it('should insert and retrieve a tenant record', async () => {
    const tenantId = `tenant-${uuid()}`;
    const now = new Date().toISOString();

    await pool.query(
      `INSERT INTO causeflow.tenants (tenant_id, entity_id, data, created_at, updated_at)
       VALUES ($1, $2, $3::jsonb, $4, $5)`,
      [
        tenantId,
        tenantId,
        JSON.stringify({
          name: 'Test Tenant',
          plan: 'free',
          status: 'active',
          ownerEmail: 'owner@test.com',
        }),
        now,
        now,
      ],
    );

    const result = await pool.query(
      `SELECT tenant_id, entity_id, data FROM causeflow.tenants
       WHERE tenant_id = $1 AND entity_id = $2`,
      [tenantId, tenantId],
    );

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].data.name).toBe('Test Tenant');
    expect(result.rows[0].data.plan).toBe('free');
  });

  it('should insert and query incidents by tenant', async () => {
    const now = new Date().toISOString();
    const incidentIds = ['INC#001', 'INC#002', 'INC#003'];

    for (const id of incidentIds) {
      await pool.query(
        `INSERT INTO causeflow.incidents (tenant_id, entity_id, data, created_at, updated_at)
         VALUES ($1, $2, $3::jsonb, $4, $5)`,
        [
          testTenantId,
          id,
          JSON.stringify({
            severity: id === 'INC#001' ? 'critical' : id === 'INC#002' ? 'high' : 'low',
            title: `Incident ${id}`,
            status: 'open',
          }),
          now,
          now,
        ],
      );
    }

    const result = await pool.query(
      `SELECT entity_id, data FROM causeflow.incidents
       WHERE tenant_id = $1
       ORDER BY entity_id`,
      [testTenantId],
    );

    expect(result.rows).toHaveLength(3);
    expect(result.rows[0].entity_id).toBe('INC#001');
    expect(result.rows[0].data.severity).toBe('critical');
    expect(result.rows[1].data.severity).toBe('high');
    expect(result.rows[2].data.severity).toBe('low');
  });

  it('should update JSONB data fields', async () => {
    const incidentId = `INC-UPDATE-${uuid()}`;
    const now = new Date().toISOString();

    // Insert
    await pool.query(
      `INSERT INTO causeflow.incidents (tenant_id, entity_id, data, created_at, updated_at)
       VALUES ($1, $2, $3::jsonb, $4, $5)`,
      [testTenantId, incidentId, JSON.stringify({ status: 'open', severity: 'low' }), now, now],
    );

    // Update using Postgres JSONB merge
    await pool.query(
      `UPDATE causeflow.incidents
       SET data = data || $3::jsonb, updated_at = $4
       WHERE tenant_id = $1 AND entity_id = $2`,
      [
        testTenantId,
        incidentId,
        JSON.stringify({ status: 'triaged', severity: 'high' }),
        new Date().toISOString(),
      ],
    );

    const result = await pool.query(
      `SELECT data FROM causeflow.incidents
       WHERE tenant_id = $1 AND entity_id = $2`,
      [testTenantId, incidentId],
    );

    expect(result.rows[0].data.status).toBe('triaged');
    expect(result.rows[0].data.severity).toBe('high');
  });

  it('should delete items', async () => {
    const deleteId = `INC-DELETE-${uuid()}`;
    const now = new Date().toISOString();

    await pool.query(
      `INSERT INTO causeflow.incidents (tenant_id, entity_id, data, created_at, updated_at)
       VALUES ($1, $2, $3::jsonb, $4, $5)`,
      [testTenantId, deleteId, JSON.stringify({ data: 'to-delete' }), now, now],
    );

    const before = await pool.query(
      `SELECT entity_id FROM causeflow.incidents
       WHERE tenant_id = $1 AND entity_id = $2`,
      [testTenantId, deleteId],
    );
    expect(before.rows).toHaveLength(1);

    await pool.query(
      `DELETE FROM causeflow.incidents
       WHERE tenant_id = $1 AND entity_id = $2`,
      [testTenantId, deleteId],
    );

    const after = await pool.query(
      `SELECT entity_id FROM causeflow.incidents
       WHERE tenant_id = $1 AND entity_id = $2`,
      [testTenantId, deleteId],
    );
    expect(after.rows).toHaveLength(0);
  });

  it('should support tenant-scoped queries (isolation)', async () => {
    const tenantA = `tenant-a-${uuid()}`;
    const tenantB = `tenant-b-${uuid()}`;
    const now = new Date().toISOString();

    // Insert one incident for tenant A
    await pool.query(
      `INSERT INTO causeflow.incidents (tenant_id, entity_id, data, created_at, updated_at)
       VALUES ($1, $2, $3::jsonb, $4, $5)`,
      [tenantA, 'INC-001', JSON.stringify({ title: 'Tenant A incident' }), now, now],
    );

    // Insert two incidents for tenant B
    for (let i = 0; i < 2; i++) {
      await pool.query(
        `INSERT INTO causeflow.incidents (tenant_id, entity_id, data, created_at, updated_at)
         VALUES ($1, $2, $3::jsonb, $4, $5)`,
        [
          tenantB,
          `INC-00${i + 1}`,
          JSON.stringify({ title: `Tenant B incident ${i + 1}` }),
          now,
          now,
        ],
      );
    }

    // Tenant A should only see 1 incident
    const resultA = await pool.query(
      `SELECT entity_id FROM causeflow.incidents WHERE tenant_id = $1`,
      [tenantA],
    );
    expect(resultA.rows).toHaveLength(1);

    // Tenant B should see 2 incidents
    const resultB = await pool.query(
      `SELECT entity_id FROM causeflow.incidents WHERE tenant_id = $1`,
      [tenantB],
    );
    expect(resultB.rows).toHaveLength(2);

    // Clean up
    await pool.query('DELETE FROM causeflow.incidents WHERE tenant_id = $1', [tenantA]);
    await pool.query('DELETE FROM causeflow.incidents WHERE tenant_id = $1', [tenantB]);
  });

  it('should handle audit hash chain pattern', async () => {
    const auditTenantId = `audit-${uuid()}`;
    let previousHash = '';

    for (let i = 0; i < 5; i++) {
      const entryId = `ENTRY#${String(i).padStart(10, '0')}`;
      const now = new Date().toISOString();
      const hash = `hash-${i}`;

      await pool.query(
        `INSERT INTO causeflow.audit_entries (tenant_id, entity_id, data, created_at, updated_at)
         VALUES ($1, $2, $3::jsonb, $4, $5)`,
        [
          auditTenantId,
          entryId,
          JSON.stringify({
            action: 'test.action',
            previousHash,
            hash,
          }),
          now,
          now,
        ],
      );
      previousHash = `hash-${i}`;
    }

    const result = await pool.query(
      `SELECT entity_id, data FROM causeflow.audit_entries
       WHERE tenant_id = $1
       ORDER BY entity_id`,
      [auditTenantId],
    );

    expect(result.rows).toHaveLength(5);

    // Verify chain integrity
    let prevHash = '';
    for (const row of result.rows) {
      expect(row.data.previousHash).toBe(prevHash);
      prevHash = row.data.hash;
    }

    // Clean up
    await pool.query('DELETE FROM causeflow.audit_entries WHERE tenant_id = $1', [auditTenantId]);
  });
});
