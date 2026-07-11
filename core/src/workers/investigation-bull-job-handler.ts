/**
 * BullMQ investigation job handler (OSS long-lived worker).
 *
 * Separated from investigation-worker.ts so unit tests can cover followup /
 * terminal-status short-circuits without booting the full worker bootstrap.
 *
 * AC-060: ChatInvestigationUseCase may enqueue mode:followup after REST chat.
 * Those jobs must NOT re-run InvestigateIncidentUseCase on terminal incidents
 * (awaiting_approval / resolved / failed) — doing so throws
 * IncidentNotInvestigatableError and the old catch path clobbered rootCause
 * with an error placeholder.
 */
import type { IIncidentRepository } from '../modules/ingestion/domain/incident.repository.js';
import { IncidentNotInvestigatableError } from '../modules/investigation/domain/investigation.errors.js';
import type { IncidentStatus } from '../shared/domain/types.js';
import { tenantId, incidentId } from '../shared/domain/value-objects.js';
import { logger } from '../shared/infra/logger.js';

const DEFAULT_SUGGESTED_AGENTS = [
  'log_analyst',
  'metric_analyst',
  'change_detector',
  'code_analyzer',
  'infra_inspector',
  'db_analyst',
];

/** Statuses where a full investigation must not be (re)started. */
export const TERMINAL_INVESTIGATION_STATUSES: ReadonlySet<IncidentStatus> = new Set([
  'awaiting_approval',
  'resolved',
  'failed',
  'closed',
  'aborted',
  'cost_exceeded',
  'inconclusive',
  'remediating',
]);

export interface InvestigationBullJobDeps {
  investigateIncident: {
    execute: (input: {
      tenantId: ReturnType<typeof tenantId>;
      incidentId: ReturnType<typeof incidentId>;
      suggestedAgents: string[];
    }) => Promise<unknown>;
  };
  incidentRepo: IIncidentRepository;
}

export async function handleInvestigationBullJob(
  body: Record<string, unknown>,
  deps: InvestigationBullJobDeps,
): Promise<void> {
  const tid = body['tenantId'] as string | undefined;
  const iid = body['incidentId'] as string | undefined;
  const mode = (body['mode'] as string | undefined) ?? 'investigate';
  const rawAgents = body['suggestedAgents'] as string[] | undefined;
  const suggestedAgents =
    rawAgents && rawAgents.length > 0 ? rawAgents : DEFAULT_SUGGESTED_AGENTS;

  if (!tid || !iid) {
    logger.warn({ body }, 'BullMQ investigation job missing tenantId or incidentId — skipping');
    return;
  }

  // Followup jobs are for WebSocket idle Q&A (ECS one-shot). On the OSS BullMQ
  // consumer, REST chat already answered — complete as no-op.
  if (mode === 'followup') {
    logger.info(
      { incidentId: iid, tenantId: tid, mode },
      'investigation:followup-skip — REST/chat followup job; not re-investigating',
    );
    return;
  }

  const tId = tenantId(tid);
  const iId = incidentId(iid);

  const existing = await deps.incidentRepo.findById(tId, iId);
  if (existing && TERMINAL_INVESTIGATION_STATUSES.has(existing.status)) {
    logger.info(
      { incidentId: iid, tenantId: tid, status: existing.status },
      'investigation:terminal-skip — incident already terminal; not re-investigating',
    );
    return;
  }

  logger.info({ incidentId: iid, tenantId: tid, suggestedAgents, mode }, 'investigation:start');
  try {
    await deps.investigateIncident.execute({
      tenantId: tId,
      incidentId: iId,
      suggestedAgents,
    });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown error';
    logger.error({ err, incidentId: iid, tenantId: tid }, 'Investigation job failed');

    // Never clobber a completed synthesis rootCause (AC-060 followup race).
    if (err instanceof IncidentNotInvestigatableError) {
      logger.warn(
        { incidentId: iid, tenantId: tid, errorMsg },
        'IncidentNotInvestigatableError — leaving incident status/rootCause unchanged',
      );
      return;
    }

    try {
      const current = await deps.incidentRepo.findById(tId, iId);
      if (current && TERMINAL_INVESTIGATION_STATUSES.has(current.status)) {
        logger.warn(
          { incidentId: iid, tenantId: tid, status: current.status },
          'Investigation error on terminal incident — not overwriting rootCause',
        );
        return;
      }
      if (current?.rootCause && !/cannot be investigated/i.test(current.rootCause)) {
        logger.warn(
          { incidentId: iid, tenantId: tid },
          'Investigation error but synthesis rootCause present — not overwriting',
        );
        await deps.incidentRepo.updateStatus(tId, iId, 'failed');
        return;
      }
      await deps.incidentRepo.update(tId, iId, {
        rootCause: errorMsg,
        updatedAt: new Date().toISOString(),
      });
      await deps.incidentRepo.updateStatus(tId, iId, 'failed');
    } catch (statusErr) {
      logger.error({ err: statusErr, incidentId: iid }, 'Failed to mark investigation as failed');
    }
    throw new Error(errorMsg);
  }
}
