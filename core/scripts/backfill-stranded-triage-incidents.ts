// Refs: docs/tasks/investigation/bugfix/2026-04-30_2152-triage-terminal-conclusion/spec.md
// Tenant iteration strategy: accepts --tenant <id> for a single tenant, or falls back to
// BACKFILL_TENANT_IDS env var (comma-separated list); no wildcard/list-all API available.

/**
 * One-shot backfill script for incidents stranded in status=triaging.
 *
 * Finds incidents that:
 *   - have status === 'triaging'
 *   - were last updated more than 5 minutes ago
 *   - have no rootCause set
 *   - have at least one evidence row with agentRole === 'coordinator'
 *     and evidenceType === 'agent_reasoning'
 *
 * Writes rootCause from the most-recent coordinator agent_reasoning evidence,
 * then transitions status to 'resolved' via UpdateIncidentStatusUseCase.
 *
 * Default behaviour is dry-run. Pass --apply to write.
 *
 * Usage:
 *   pnpm backfill:stranded-triage [--apply] [--tenant <id>] [--limit <N>]
 */

import type { IIncidentRepository } from '../src/modules/ingestion/domain/incident.repository.js';
import type { IEvidenceRepository } from '../src/modules/triage/domain/evidence.repository.js';
import type { ITenantRepository } from '../src/modules/tenant/domain/tenant.repository.js';
import type { UpdateIncidentStatusUseCase } from '../src/modules/ingestion/application/update-incident-status.usecase.js';
import type { Incident } from '../src/modules/ingestion/domain/incident.entity.js';
import type { Evidence } from '../src/modules/triage/domain/evidence.repository.js';
import type { TenantId, IncidentId } from '../src/shared/domain/value-objects.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BackfillDeps {
  incidentRepo: IIncidentRepository;
  evidenceRepo: IEvidenceRepository;
  /** Optional — only used in CLI path for listing tenants via env var fallback */
  tenantRepo: ITenantRepository;
  updateIncidentStatus: UpdateIncidentStatusUseCase;
}

export interface BackfillOpts {
  /** When false (default), only print planned writes without executing them. */
  apply: boolean;
  /** Scope to a single tenant ID. Required when BACKFILL_TENANT_IDS env var is not set. */
  tenant?: string;
  /** Maximum number of incidents to process per run (default 100). */
  limit: number;
}

// ---------------------------------------------------------------------------
// Core logic (exported for testability)
// ---------------------------------------------------------------------------

const STALE_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes

function isStranded(incident: Incident): boolean {
  if (incident.status !== 'triaging') return false;
  if (incident.rootCause) return false;
  const updatedMs = new Date(incident.updatedAt).getTime();
  return Date.now() - updatedMs > STALE_THRESHOLD_MS;
}

function pickBestCoordinatorEvidence(evidences: Evidence[]): Evidence | undefined {
  const candidates = evidences.filter(
    (e) => e.agentRole === 'coordinator' && e.evidenceType === 'agent_reasoning',
  );
  if (candidates.length === 0) return undefined;
  // Use most recent by createdAt
  return candidates.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  )[0];
}

export async function runBackfill(deps: BackfillDeps, opts: BackfillOpts): Promise<void> {
  const { incidentRepo, evidenceRepo, updateIncidentStatus } = deps;
  const { apply, limit } = opts;

  // Determine which tenants to scan
  const tenantIds: string[] = opts.tenant
    ? [opts.tenant]
    : (process.env['BACKFILL_TENANT_IDS'] ?? '')
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);

  if (tenantIds.length === 0) {
    console.log('[backfill] ERROR: No tenants specified. Pass --tenant <id> or set BACKFILL_TENANT_IDS env var.');
    process.exitCode = 1;
    return;
  }

  let totalProcessed = 0;

  for (const rawTenantId of tenantIds) {
    if (totalProcessed >= limit) {
      console.log(`[backfill] Limit of ${limit} reached. Stopping.`);
      break;
    }

    const tId = rawTenantId as TenantId;
    console.log(`[backfill] Scanning tenant ${tId}...`);

    const allIncidents = await incidentRepo.findAll(tId);
    const stranded = allIncidents.filter(isStranded);

    console.log(`[backfill] Found ${stranded.length} stranded incident(s) in tenant ${tId}.`);

    for (const incident of stranded) {
      if (totalProcessed >= limit) break;

      const iId = incident.incidentId as IncidentId;
      const evidences = await evidenceRepo.findByIncident(tId, iId);
      const best = pickBestCoordinatorEvidence(evidences);

      if (!best) {
        console.log(
          `[backfill] Skipping ${iId} — no coordinator agent_reasoning evidence found.`,
        );
        continue;
      }

      const summary = best.content;

      if (!apply) {
        console.log(
          `[backfill] [DRY-RUN] would resolve ${iId} with rootCause "${summary}"`,
        );
        continue;
      }

      // Write rootCause first (mirrors triage-incident pattern lines 152-155)
      await incidentRepo.update(tId, iId, {
        rootCause: summary,
        updatedAt: new Date().toISOString(),
      });

      // Then transition status via use case (fires incident.status_changed event)
      await updateIncidentStatus.execute(tId, iId, 'resolved');

      console.log(`[backfill] Resolved ${iId} (tenant ${tId}) with rootCause "${summary}"`);
      totalProcessed++;
    }
  }

  console.log(`[backfill] Done. Total resolved: ${apply ? totalProcessed : 0} (apply=${apply})`);
}

// ---------------------------------------------------------------------------
// CLI wrapper
// ---------------------------------------------------------------------------

function parseArgs(argv: string[]): BackfillOpts {
  const apply = argv.includes('--apply');
  const tenantIdx = argv.indexOf('--tenant');
  const tenant = tenantIdx !== -1 ? argv[tenantIdx + 1] : undefined;
  const limitIdx = argv.indexOf('--limit');
  const limit = limitIdx !== -1 ? parseInt(argv[limitIdx + 1] ?? '100', 10) : 100;
  return { apply, tenant, limit };
}

// Top-level await ESM entry point — only runs when executed directly (not imported)
const isMain =
  typeof process !== 'undefined' &&
  process.argv[1] !== undefined &&
  (process.argv[1].endsWith('backfill-stranded-triage-incidents.ts') ||
    process.argv[1].endsWith('backfill-stranded-triage-incidents.js'));

if (isMain) {
  (async () => {
    // Inline minimal composition — do NOT import from bootstrap.ts (has side-effects)
    // Requires env vars: AWS_REGION, DYNAMODB_TABLE_NAME, DYNAMODB_ENDPOINT (or real AWS config)
    const { DynamoIncidentRepository } = await import(
      '../src/modules/ingestion/infra/dynamo-incident.repository.js'
    );
    const { DynamoEvidenceRepository } = await import(
      '../src/modules/triage/infra/dynamo-evidence.repository.js'
    );
    const { DynamoTenantRepository } = await import(
      '../src/modules/tenant/infra/dynamo-tenant.repository.js'
    );
    const { UpdateIncidentStatusUseCase } = await import(
      '../src/modules/ingestion/application/update-incident-status.usecase.js'
    );
    const { EventBus } = await import('../src/shared/domain/events.js');

    // Dynamo repos self-initialize from env vars (no-arg constructors mirror bootstrap.ts)
    const incidentRepo = new DynamoIncidentRepository();
    const evidenceRepo = new DynamoEvidenceRepository();
    const tenantRepo = new DynamoTenantRepository();
    const eventBus = new EventBus();
    const updateIncidentStatus = new UpdateIncidentStatusUseCase(incidentRepo, eventBus);

    const opts = parseArgs(process.argv.slice(2));

    console.log('[backfill] Starting backfill-stranded-triage-incidents');
    console.log(`[backfill] Options: apply=${opts.apply}, tenant=${opts.tenant ?? '(from env)'}, limit=${opts.limit}`);

    await runBackfill(
      { incidentRepo, evidenceRepo, tenantRepo, updateIncidentStatus },
      opts,
    );
  })().catch((err) => {
    console.error('[backfill] Fatal error:', err);
    process.exit(1);
  });
}
