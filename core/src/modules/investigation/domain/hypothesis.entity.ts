import type { IncidentId, TenantId } from '../../../shared/domain/value-objects.js';

/**
 * Pointer to an Evidence record (or tool-call observation) that informed a
 * hypothesis's confidence. Kept intentionally small — the full Evidence
 * lives in its own collection and is retrieved by id.
 */
export interface HypothesisEvidenceRef {
  /** Evidence entity id when persisted, or a synthetic id for tool observations. */
  evidenceId: string;
  /**
   * Which role produced the reference.
   *  - seeker / validator / judge → hypothesis-driven mode
   *  - advocate / prosecutor / judge → multi-agent debate mode
   */
  sourcedBy: 'seeker' | 'validator' | 'advocate' | 'prosecutor' | 'judge';
  /** Short human-readable summary — one sentence. */
  summary: string;
  /**
   * Signed weight the producer assigned. Positive = supports the hypothesis,
   * negative = undermines it. Range [-1.0, 1.0].
   */
  weight: number;
  /** Optional tool name when the evidence came from a specific tool call. */
  toolName?: string;
  /** Optional ISO timestamp of when the evidence was gathered. */
  observedAt?: string;
}

export type HypothesisStatus = 'pending' | 'confirmed' | 'rejected';

/**
 * A candidate root-cause proposition tracked through the hypothesis-driven
 * and debate modes. Populated in three stages:
 *   1. Seeker generates the statement + initial confidence.
 *   2. Validator (or advocate/prosecutor in debate) appends evidence and
 *      updates confidence as each tool call resolves.
 *   3. Judge assigns the final score and marks status confirmed/rejected.
 */
export interface Hypothesis {
  hypothesisId: string;
  tenantId: TenantId;
  incidentId: IncidentId;
  /** Short declarative statement, e.g. "Connection pool exhaustion on api-server". */
  statement: string;
  /** Optional free-text rationale from the seeker for why this is plausible. */
  rationale?: string;
  /**
   * Provenance of the hypothesis. Values are tag strings:
   *   - `pattern:<id>` — a catalog pattern informed this (e.g. pattern:deploy-regression)
   *   - `memory:<ref>` — a Hindsight memory recall informed this
   *   - `integration:<provider>:<ref>` — a live integration signal informed this
   *   - `llm:prior` — generated from general LLM SRE knowledge alone
   */
  informedBy?: string[];
  /**
   * Running confidence in [0, 1]. Starts from the seeker's prior and is
   * updated by the validator/advocate as evidence arrives.
   */
  confidence: number;
  evidenceFor: HypothesisEvidenceRef[];
  evidenceAgainst: HypothesisEvidenceRef[];
  status: HypothesisStatus;
  /**
   * Final 0-100 score assigned by the judge. Undefined until the judge
   * runs. The hypothesis with the highest finalScore becomes the incident's
   * rootCause.
   */
  finalScore?: number;
  /** Populated when status = 'rejected'. Explains why. */
  rejectedReason?: string;
  /** Parent hypothesis id for tree links (root hypotheses omit this). */
  parentId?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Convenience factory used by the seeker phase. Keeps defaults in one place.
 */
export function createPendingHypothesis(params: {
  hypothesisId: string;
  tenantId: TenantId;
  incidentId: IncidentId;
  statement: string;
  confidence: number;
  rationale?: string;
  informedBy?: string[];
  parentId?: string;
  now?: Date;
}): Hypothesis {
  const now = (params.now ?? new Date()).toISOString();
  return {
    hypothesisId: params.hypothesisId,
    tenantId: params.tenantId,
    incidentId: params.incidentId,
    statement: params.statement,
    rationale: params.rationale,
    informedBy: params.informedBy,
    confidence: params.confidence,
    parentId: params.parentId,
    evidenceFor: [],
    evidenceAgainst: [],
    status: 'pending',
    createdAt: now,
    updatedAt: now,
  };
}
