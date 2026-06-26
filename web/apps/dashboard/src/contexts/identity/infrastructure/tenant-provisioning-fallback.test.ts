/**
 * Tests for tenant-provisioning-fallback.
 *
 * This module writes a Tenant + BillingAccount record directly to the Core
 * DynamoDB table in the ElectroDB-compatible shape. It exists as a temporary
 * workaround while a Core API fix is pending deploy — see the module's
 * JSDoc for the full story.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildBillingAccountRecord, buildTenantRecord } from './tenant-provisioning-fallback';

describe('buildTenantRecord', () => {
  it('produces an ElectroDB-compatible tenant record', () => {
    const record = buildTenantRecord({
      tenantId: 'org_3C5UXT5AXXhZImKg1KhLa5ErqE3',
      name: 'Acme Corp',
      slug: 'acme-corp',
      ownerEmail: 'OWNER@acme.com',
      createdAt: '2026-04-08T19:00:00.000Z',
    });

    // pk / sk format matches the Core's TenantEntity.primary index.
    // ElectroDB lowercases composite values.
    expect(record.pk).toBe('$causeflow#tenantid_org_3c5uxt5axxhzimkg1khla5erqe3');
    expect(record.sk).toBe('$tenant_1');

    // ElectroDB metadata is required for future reads to work.
    expect(record.__edb_e__).toBe('tenant');
    expect(record.__edb_v__).toBe('1');

    // tenantId is stored in its original case (ElectroDB keeps attributes
    // untouched; only the composed keys are lowercased).
    expect(record.tenantId).toBe('org_3C5UXT5AXXhZImKg1KhLa5ErqE3');
    expect(record.name).toBe('Acme Corp');
    expect(record.slug).toBe('acme-corp');
    expect(record.ownerEmail).toBe('OWNER@acme.com');
    expect(record.plan).toBe('starter');
    expect(record.status).toBe('active');
    expect(record.cancelAtPeriodEnd).toBe(false);
    expect(record.createdAt).toBe('2026-04-08T19:00:00.000Z');
    expect(record.updatedAt).toBe('2026-04-08T19:00:00.000Z');

    // GSIs required so Core API's byOwner/bySlug queries find this tenant.
    expect(record.gsi1pk).toBe('$causeflow#slug_acme-corp');
    expect(record.gsi1sk).toBe('$tenant_1');
    expect(record.gsi2pk).toBe('$causeflow#owneremail_owner@acme.com');
    expect(record.gsi2sk).toBe('$tenant_1#createdat_2026-04-08t19:00:00.000z');
  });

  it('accepts an empty ownerEmail and still produces a valid GSI2 key', () => {
    const record = buildTenantRecord({
      tenantId: 'org_test',
      name: 'Test',
      slug: 'test-1',
      ownerEmail: '',
      createdAt: '2026-01-01T00:00:00.000Z',
    });
    expect(record.ownerEmail).toBe('');
    expect(record.gsi2pk).toBe('$causeflow#owneremail_');
  });
});

describe('buildBillingAccountRecord', () => {
  it('produces an ElectroDB-compatible billing account record with starter defaults', () => {
    const record = buildBillingAccountRecord({
      tenantId: 'org_3C5UXT5AXXhZImKg1KhLa5ErqE3',
      createdAt: '2026-04-08T19:00:00.000Z',
    });

    expect(record.pk).toBe('$causeflow#tenantid_org_3c5uxt5axxhzimkg1khla5erqe3');
    expect(record.sk).toBe('$billingaccount_1');
    expect(record.__edb_e__).toBe('billingAccount');
    expect(record.__edb_v__).toBe('1');
    expect(record.tenantId).toBe('org_3C5UXT5AXXhZImKg1KhLa5ErqE3');
    expect(record.investigationsLimit).toBe(15);
    expect(record.investigationsUsed).toBe(0);
    expect(record.eventsLimit).toBe(500);
    expect(record.eventsUsed).toBe(0);
    expect(record.createdAt).toBe('2026-04-08T19:00:00.000Z');
    expect(record.updatedAt).toBe('2026-04-08T19:00:00.000Z');
  });
});

describe('provisionTenantDirect integration (mocked DynamoDB client)', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('PUTs both tenant and billing account records in a single batch', async () => {
    const send = vi.fn().mockResolvedValue({});
    vi.doMock('@aws-sdk/lib-dynamodb', () => ({
      DynamoDBDocumentClient: { from: () => ({ send }) },
      BatchWriteCommand: class BatchWriteCommand {
        input: unknown;
        constructor(input: unknown) {
          this.input = input;
        }
      },
    }));
    vi.doMock('@aws-sdk/client-dynamodb', () => ({
      DynamoDBClient: class DynamoDBClient {},
    }));

    const { provisionTenantDirect } = await import('./tenant-provisioning-fallback');

    await provisionTenantDirect({
      tenantId: 'org_3C5UXT5AXXhZImKg1KhLa5ErqE3',
      name: 'Acme Corp',
      slug: 'acme-corp',
      ownerEmail: 'owner@acme.com',
    });

    expect(send).toHaveBeenCalledTimes(1);
    const cmd = send.mock.calls[0]?.[0] as { input: { RequestItems: Record<string, unknown[]> } };
    const tableNames = Object.keys(cmd.input.RequestItems);
    expect(tableNames).toHaveLength(1);
    const items = cmd.input.RequestItems[tableNames[0] as string] ?? [];
    expect(items).toHaveLength(2); // tenant + billingAccount
  });
});
