/**
 * Shared contracts for the incident-detail SSE stream.
 *
 * The hook lives at `presentation/hooks/use-incident-stream.ts`. The
 * `<DisconnectedBanner>` component imports these types via direct deep
 * paths — no barrels.
 */

/** Connection status of the live SSE stream. */
export type IncidentStreamStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

/** A single event from the SSE stream after parsing. */
export interface IncidentStreamEvent {
  /** SSE event name (e.g. "incident.status_changed", "audit.appended", "remediation.proposed") */
  event: string;
  /** Parsed JSON payload */
  data: Record<string, unknown>;
  /** Server-emitted timestamp if present, else client receive time */
  receivedAt: string;
}

/** Hook return shape — Sprint 2/3 components consume this. */
export interface UseIncidentStreamResult {
  status: IncidentStreamStatus;
  lastEvent: IncidentStreamEvent | null;
  /** Subscribe to a specific event type. Returns unsubscribe fn. */
  on: (eventType: string, handler: (event: IncidentStreamEvent) => void) => () => void;
  reconnect: () => void;
}

/** Agent role enum mirrors the upstream Evidence schema (core/openapi.yaml:2198). */
export const AGENT_ROLES = [
  'log_analyst',
  'metric_analyst',
  'infra_inspector',
  'orchestrator',
  'scout',
  'diagnosis_verifier',
] as const;
export type AgentRole = (typeof AGENT_ROLES)[number];

/** Props contract for the Sprint 1 `<DisconnectedBanner>` component. */
export interface DisconnectedBannerProps {
  status: IncidentStreamStatus;
  onReconnect: () => void;
}
