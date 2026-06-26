export interface RecommendedAction {
  action: string;
  label?: string;
  description?: string;
  riskLevel?: string;
}

export interface CompletionData {
  rootCause?: string;
  severity?: 'low' | 'medium' | 'high' | 'critical';
  recommendedActions?: RecommendedAction[];
  status?: string;
  costUsd?: number;
  durationMs?: number;
  agentsUsed?: string[];
}

/**
 * Summary of PII/secret fields masked by the relay before evidence
 * left the customer network. Surface this as a badge so operators
 * know the redaction happened and can see at a glance what was hit.
 */
export interface MaskingSummary {
  totalFields: number;
  detections: Array<{ detector: string; count: number }>;
}

export interface FeedItem {
  id: string;
  type:
    | 'checkpoint'
    | 'progress'
    | 'question'
    | 'guidance'
    | 'complete'
    | 'error'
    | 'idle'
    | 'followup'
    | 'tool_call'
    | 'evidence'
    | 'capabilities'
    | 'phase'
    | 'tool_error';
  message: string;
  timestamp: string;
  severity?: 'info' | 'warning' | 'critical';
  questionId?: string;
  options?: string[];
  timeoutMs?: number;
  answered?: boolean;
  completion?: CompletionData;
  toolName?: string;
  toolInput?: Record<string, unknown>;
  evidenceType?: string;
  agentRole?: string;
  label?: string;
  memoriesFound?: number;
  skippedInvestigation?: boolean;
  category?: string;
  capabilities?: string[];
  masking?: MaskingSummary;
  /**
   * Deterministic citation fields — present when evidence was created via
   * `cite_evidence`. The backend validates that `quote` is a literal substring
   * of tool call `toolCallId`'s output before persisting, so if these three
   * are present the evidence is traceable to an exact tool I/O.
   */
  toolCallId?: string;
  claim?: string;
  quote?: string;
}

/**
 * Stages that mutate the Hypothesis entity set (seeker creates, judge
 * scores, reseek regenerates). UI views rendering hypotheses should
 * refresh whenever one of these fires.
 */
export const HYPOTHESIS_MUTATING_STAGES = ['hypothesize', 'judge', 'reseek'] as const;

export type HypothesisMutatingStage = (typeof HYPOTHESIS_MUTATING_STAGES)[number];

export interface InvestigationLiveFeedProps {
  incidentId: string;
  isInProgress: boolean;
  onStatusChange?: () => void;
  onConnectionChange?: (connected: boolean) => void;
  /**
   * Fired whenever the WS relay pushes a progress event for a stage
   * that mutates the hypothesis set. Consumers typically use this to
   * bump a refresh token on `HypothesisDebateView` so the UI reflects
   * intermediate state (e.g. 3 pending hypotheses right after the
   * seeker completes) instead of waiting for the terminal status
   * transition.
   */
  onHypothesisProgress?: (stage: HypothesisMutatingStage) => void;
}
