/**
 * Tests for scripts/backfill-stranded-triage-incidents.ts
 *
 * Two scenarios:
 *  1. Single-tenant 3-incident scenario: only the stranded-with-coordinator-evidence
 *     incident gets transitioned.
 *  2. Cross-tenant isolation: two tenants each with a stranded match — running with
 *     --tenant tenant_A leaves tenant_B untouched.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runBackfill } from '../../../scripts/backfill-stranded-triage-incidents.js';
import type { IIncidentRepository } from '../../../src/modules/ingestion/domain/incident.repository.js';
import type { Incident } from '../../../src/modules/ingestion/domain/incident.entity.js';
import type { IEvidenceRepository, Evidence } from '../../../src/modules/triage/domain/evidence.repository.js';
import type { ITenantRepository } from '../../../src/modules/tenant/domain/tenant.repository.js';
import type { Tenant } from '../../../src/modules/tenant/domain/tenant.entity.js';
import { UpdateIncidentStatusUseCase } from '../../../src/modules/ingestion/application/update-incident-status.usecase.js';
import { EventBus } from '../../../src/shared/domain/events.js';
import { tenantId, incidentId, evidenceId } from '../../../src/shared/domain/value-objects.js';
import type { TenantId, IncidentId } from '../../../src/shared/domain/value-objects.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------


function makeIncident(overrides: Partial<Incident> & Pick<Incident, 'incidentId' | 'tenantId'>): Incident {
  return {
    title: 'Test incident',
    description: 'desc',
    severity: 'low',
    status: 'triaging',
    sourceProvider: 'datadog',
    sourceAlertId: 'alert-1',
    rootCause: undefined,
    createdAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(), // 10 min ago
    updatedAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(), // 10 min ago (old)
    ...overrides,
  };
}

function makeEvidence(
  tId: ReturnType<typeof tenantId>,
  iId: ReturnType<typeof incidentId>,
  overrides?: Partial<Evidence>,
): Evidence {
  return {
    tenantId: tId,
    incidentId: iId,
    evidenceId: evidenceId('ev-001'),
    agentRole: 'coordinator',
    evidenceType: 'agent_reasoning',
    content: 'Root cause identified: memory leak in service X',
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

function makeTenant(id: string): Tenant {
  return {
    tenantId: tenantId(id),
    name: `Tenant ${id}`,
    slug: id,
    ownerEmail: `owner@${id}.com`,
    plan: 'starter',
    status: 'active',
    settings: {
      maxIncidentsPerMonth: 50,
      autoRemediation: false,
      notificationChannels: [],
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Mock factories
// ---------------------------------------------------------------------------

function makeIncidentRepo(incidents: Incident[]): IIncidentRepository {
  const store = [...incidents];
  return {
    create: vi.fn(),
    findById: vi.fn(async (tId, iId) => {
      const found = store.find((i) => i.tenantId === tId && i.incidentId === iId);
      // Return a shallow copy so callers don't hold a live reference into the store
      return found ? { ...found } : null;
    }),
    findBySourceAlert: vi.fn(),
    update: vi.fn(async (_tId: TenantId, _iId: IncidentId, data: Partial<Incident>) => {
      const item = store.find((i) => i.tenantId === _tId && i.incidentId === _iId);
      if (item) Object.assign(item, data);
      return { ...item, ...data } as Incident;
    }),
    updateStatus: vi.fn(async (_tId: TenantId, _iId: IncidentId, status: string, resolvedAt?: string) => {
      const item = store.find((i) => i.tenantId === _tId && i.incidentId === _iId);
      if (item) {
        item.status = status as Incident['status'];
        if (resolvedAt) item.resolvedAt = resolvedAt;
      }
      return { ...item } as Incident;
    }),
    listByTenant: vi.fn(async (tId) => ({
      items: store.filter((i) => i.tenantId === tId),
    })),
    findBySeverity: vi.fn(async () => ({ items: [] })),
    findByStatus: vi.fn(async () => ({ items: [] })),
    listByCreatedAt: vi.fn(async () => ({ items: [] })),
    findAll: vi.fn(async (tId) => store.filter((i) => i.tenantId === tId)),
  };
}

function makeEvidenceRepo(evidences: Evidence[]): IEvidenceRepository {
  return {
    create: vi.fn(),
    findByIncident: vi.fn(async (tId, iId) =>
      evidences.filter((e) => e.tenantId === tId && e.incidentId === iId),
    ),
    listByAgentRole: vi.fn(async () => []),
  };
}

function makeTenantRepo(tenants: Tenant[]): ITenantRepository {
  return {
    create: vi.fn(),
    findById: vi.fn(async (tId) => tenants.find((t) => t.tenantId === tId) ?? null),
    findBySlug: vi.fn(),
    findByCustomDomain: vi.fn(),
    update: vi.fn(),
    listByOwner: vi.fn(),
  };
}

// ---------------------------------------------------------------------------
// Scenario 1: Single-tenant 3-incident scenario
// ---------------------------------------------------------------------------

describe('backfill — single-tenant 3-incident scenario', () => {
  const TENANT_A = tenantId('tenant_A');

  const INC_A = incidentId('inc-stranded-with-evidence'); // (a) stranded match
  const INC_B = incidentId('inc-stranded-no-evidence');   // (b) stranded but missing coordinator evidence
  const INC_C = incidentId('inc-fresh-triaging');          // (c) freshly triaging < 5 min

  const freshUpdatedAt = new Date(Date.now() - 2 * 60 * 1000).toISOString(); // 2 min ago

  const incidents: Incident[] = [
    makeIncident({ incidentId: INC_A, tenantId: TENANT_A }),
    makeIncident({ incidentId: INC_B, tenantId: TENANT_A }),
    makeIncident({ incidentId: INC_C, tenantId: TENANT_A, updatedAt: freshUpdatedAt }),
  ];

  const evidences: Evidence[] = [
    makeEvidence(TENANT_A, INC_A), // only incident A has coordinator evidence
  ];

  let incidentRepo: IIncidentRepository;
  let evidenceRepo: IEvidenceRepository;
  let tenantRepo: ITenantRepository;
  let updateIncidentStatus: UpdateIncidentStatusUseCase;
  let eventBus: EventBus;

  beforeEach(() => {
    incidentRepo = makeIncidentRepo(incidents.map((i) => ({ ...i }))); // fresh copy each test
    evidenceRepo = makeEvidenceRepo(evidences);
    tenantRepo = makeTenantRepo([makeTenant('tenant_A')]);
    eventBus = new EventBus();
    updateIncidentStatus = new UpdateIncidentStatusUseCase(incidentRepo, eventBus);
  });

  it('dry-run: zero writes regardless of matches', async () => {
    await runBackfill(
      { incidentRepo, evidenceRepo, tenantRepo, updateIncidentStatus },
      { apply: false, tenant: 'tenant_A', limit: 100 },
    );

    expect(incidentRepo.update).not.toHaveBeenCalled();
    expect(incidentRepo.updateStatus).not.toHaveBeenCalled();
  });

  it('apply: only incident (a) gets resolved; eventBus.publish called exactly once', async () => {
    const published: unknown[] = [];
    eventBus.subscribe('incident.status_changed', (e) => { published.push(e); });

    await runBackfill(
      { incidentRepo, evidenceRepo, tenantRepo, updateIncidentStatus },
      { apply: true, tenant: 'tenant_A', limit: 100 },
    );

    // incidentRepo.update called once for rootCause (incident A only)
    expect(incidentRepo.update).toHaveBeenCalledTimes(1);
    expect(incidentRepo.update).toHaveBeenCalledWith(
      TENANT_A,
      INC_A,
      expect.objectContaining({ rootCause: expect.any(String) }),
    );

    // updateStatus called once for incident A → resolved
    expect(incidentRepo.updateStatus).toHaveBeenCalledTimes(1);
    expect(incidentRepo.updateStatus).toHaveBeenCalledWith(
      TENANT_A,
      INC_A,
      'resolved',
      expect.any(String),
    );

    // eventBus published exactly once (triaging → resolved)
    expect(published).toHaveLength(1);
    const event = published[0] as any;
    expect(event.payload.from).toBe('triaging');
    expect(event.payload.to).toBe('resolved');
    expect(event.payload.incidentId).toBe(INC_A);
  });
});

// ---------------------------------------------------------------------------
// Scenario 2: Cross-tenant isolation
// ---------------------------------------------------------------------------

describe('backfill — cross-tenant isolation', () => {
  const TENANT_A = tenantId('tenant_A');
  const TENANT_B = tenantId('tenant_B');

  const INC_A = incidentId('inc-tenant-a-stranded');
  const INC_B = incidentId('inc-tenant-b-stranded');

  const incidents: Incident[] = [
    makeIncident({ incidentId: INC_A, tenantId: TENANT_A }),
    makeIncident({ incidentId: INC_B, tenantId: TENANT_B }),
  ];

  const evidences: Evidence[] = [
    makeEvidence(TENANT_A, INC_A),
    makeEvidence(TENANT_B, INC_B),
  ];

  it('scoped to tenant_A: tenant_B incident is untouched', async () => {
    const incidentRepo = makeIncidentRepo(incidents.map((i) => ({ ...i })));
    const evidenceRepo = makeEvidenceRepo(evidences);
    const tenantRepo = makeTenantRepo([makeTenant('tenant_A'), makeTenant('tenant_B')]);
    const eventBus = new EventBus();
    const updateIncidentStatus = new UpdateIncidentStatusUseCase(incidentRepo, eventBus);

    const published: unknown[] = [];
    eventBus.subscribe('incident.status_changed', (e) => { published.push(e); });

    await runBackfill(
      { incidentRepo, evidenceRepo, tenantRepo, updateIncidentStatus },
      { apply: true, tenant: 'tenant_A', limit: 100 },
    );

    // Only tenant A's incident gets updated
    expect(incidentRepo.updateStatus).toHaveBeenCalledTimes(1);
    expect(incidentRepo.updateStatus).toHaveBeenCalledWith(
      TENANT_A,
      INC_A,
      'resolved',
      expect.any(String),
    );

    // Tenant B's incident must NOT have been touched
    const tenantBCalls = vi.mocked(incidentRepo.updateStatus).mock.calls.filter(
      (call) => call[0] === TENANT_B,
    );
    expect(tenantBCalls).toHaveLength(0);

    // Exactly one event published (for tenant A only)
    expect(published).toHaveLength(1);
    const event = published[0] as any;
    expect(event.tenantId).toBe(TENANT_A);
  });
});
