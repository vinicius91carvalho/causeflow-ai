'use client';

/**
 * useIncidentStream — subscribe to the live SSE stream for one incident.
 *
 * Opens a single `EventSource` against `/api/incidents/{id}/stream`, which
 * proxies Core's `GET /v1/incidents/:id/stream` as `text/event-stream`.
 * Filters events by `incidentId` so cross-incident events don't bleed in,
 * and exposes a typed subscription API.
 *
 * There is intentionally NO automatic reconnect — silent retries hide
 * upstream issues. `<DisconnectedBanner>` reads `status` and surfaces a
 * manual Retry button when the stream is not `connected`.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  IncidentStreamEvent,
  IncidentStreamStatus,
  UseIncidentStreamResult,
} from '@/contexts/investigation/domain/incident-stream-types';

function streamUrlFor(incidentId: string): string {
  return `/api/incidents/${encodeURIComponent(incidentId)}/stream`;
}

/** Internal handler shape stored in the per-event-type handler map. */
type Handler = (event: IncidentStreamEvent) => void;

/**
 * Event types we want to receive from the SSE stream. The proxy forwards all
 * upstream events; this allowlist is used to register named listeners on the
 * EventSource so we don't depend on the unnamed `message` channel for events
 * the upstream may emit with explicit `event:` lines.
 *
 * The Core API uses two competing naming styles depending on emission path:
 *   - In-process eventbus subscribers in core/src/bootstrap.ts emit
 *     SNAKE_CASE names (`investigation_progress`, `investigation_completed`,
 *     `remediation_proposed`).
 *   - The async investigation worker publishes to SQS using DOT-CASE names
 *     (`investigation.progress`, `investigation.completed`, `investigation.failed`),
 *     which the progress-consumer forwards to SSE verbatim.
 *
 * To shield consumers from this backend inconsistency we register listeners
 * for BOTH styles and `parseAndDispatch` normalizes to the canonical
 * dot-case form before invoking handlers.
 */
const WIRED_EVENT_TYPES = [
  'message',
  // Snake_case names emitted by core/src/bootstrap.ts (in-process eventbus)
  'investigation_progress',
  'investigation_completed',
  'remediation_proposed',
  // Dot-case names from the SQS progress-consumer (async investigation worker)
  // and the canonical names consumers subscribe to.
  'incident.status_changed',
  'incident.updated',
  'investigation.started',
  'investigation.progress',
  'investigation.completed',
  'investigation.aborted',
  'investigation.failed',
  'remediation.proposed',
  'remediation.approved',
  'remediation.rejected',
  'remediation.executed',
  'audit.appended',
  'agent.started',
  'agent.evidence_appended',
  'agent.completed',
  'notification.created',
] as const;

/**
 * Snake_case → canonical dot-case event-name normalization. Keeps the rest of
 * the dashboard on a single naming convention regardless of which path the
 * upstream used.
 */
const EVENT_NAME_NORMALIZATION: Readonly<Record<string, string>> = {
  investigation_progress: 'investigation.progress',
  investigation_completed: 'investigation.completed',
  investigation_failed: 'investigation.failed',
  investigation_started: 'investigation.started',
  investigation_aborted: 'investigation.aborted',
  remediation_proposed: 'remediation.proposed',
  remediation_approved: 'remediation.approved',
  remediation_rejected: 'remediation.rejected',
  remediation_executed: 'remediation.executed',
};

function canonicalizeEventName(raw: string): string {
  return EVENT_NAME_NORMALIZATION[raw] ?? raw;
}

function getEventSourceCtor(): typeof EventSource | undefined {
  if (typeof window === 'undefined') return undefined;
  return (window as unknown as { EventSource?: typeof EventSource }).EventSource;
}

export function useIncidentStream(incidentId: string): UseIncidentStreamResult {
  const [status, setStatus] = useState<IncidentStreamStatus>('connecting');
  const [lastEvent, setLastEvent] = useState<IncidentStreamEvent | null>(null);

  // Stable refs survive re-renders (handlers + current EventSource).
  const handlersRef = useRef<Map<string, Set<Handler>>>(new Map());
  const sourceRef = useRef<EventSource | null>(null);
  const incidentIdRef = useRef(incidentId);

  // Track latest incidentId for the message handlers without re-opening.
  useEffect(() => {
    incidentIdRef.current = incidentId;
  }, [incidentId]);

  /**
   * Parse a raw SSE message into an `IncidentStreamEvent`. Returns null when
   * parsing fails or when the event is for a different incident.
   */
  const parseAndDispatch = useCallback((rawEventName: string, rawData: string): void => {
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(rawData) as Record<string, unknown>;
    } catch {
      // Non-JSON payload — drop silently. Upstream proxy should always JSON-encode.
      return;
    }

    // Normalize snake_case names from the in-process eventbus to canonical
    // dot-case so subscribers don't have to know about the dual-emission paths.
    const eventName = canonicalizeEventName(rawEventName);

    // Tenant + incident isolation: events for OTHER incidents are dropped.
    // We allow events with no `incidentId` only for global types like
    // `connected` and `notification.created` — those are not actionable here
    // and never reach handler subscribers anyway.
    const eventIncidentId = parsed.incidentId as string | undefined;
    if (eventIncidentId !== undefined && eventIncidentId !== incidentIdRef.current) {
      return;
    }

    const evt: IncidentStreamEvent = {
      event: eventName,
      data: parsed,
      receivedAt: new Date().toISOString(),
    };

    setLastEvent(evt);

    const handlers = handlersRef.current.get(eventName);
    if (handlers && handlers.size > 0) {
      for (const handler of handlers) {
        try {
          handler(evt);
        } catch {
          // Subscriber errors must not break the stream loop.
        }
      }
    }
  }, []);

  const closeSource = useCallback((): void => {
    const src = sourceRef.current;
    if (src) {
      try {
        src.close();
      } catch {
        // ignore
      }
    }
    sourceRef.current = null;
  }, []);

  const openSource = useCallback((): void => {
    const Ctor = getEventSourceCtor();
    if (!Ctor) {
      // Mock mode / SSR / EventSource missing → degrade gracefully.
      setStatus('disconnected');
      return;
    }

    let source: EventSource;
    try {
      source = new Ctor(streamUrlFor(incidentIdRef.current));
    } catch {
      setStatus('error');
      return;
    }
    sourceRef.current = source;
    setStatus('connecting');

    source.onopen = () => setStatus('connected');
    source.onerror = () => setStatus('error');
    source.onmessage = (ev: MessageEvent) => {
      parseAndDispatch('message', String(ev.data));
    };

    // Register named listeners for explicit `event:` lines.
    for (const eventType of WIRED_EVENT_TYPES) {
      if (eventType === 'message') continue;
      source.addEventListener(eventType, (ev) => {
        const message = ev as MessageEvent;
        parseAndDispatch(eventType, String(message.data));
      });
    }
  }, [parseAndDispatch]);

  // Open on mount, close on unmount.
  // biome-ignore lint/correctness/useExhaustiveDependencies: openSource/closeSource are stable.
  useEffect(() => {
    openSource();
    return () => {
      closeSource();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const on = useCallback<UseIncidentStreamResult['on']>((eventType, handler) => {
    if (!handlersRef.current.has(eventType)) {
      handlersRef.current.set(eventType, new Set());
    }
    const set = handlersRef.current.get(eventType);
    set?.add(handler as Handler);
    return () => {
      handlersRef.current.get(eventType)?.delete(handler as Handler);
    };
  }, []);

  const reconnect = useCallback(() => {
    closeSource();
    openSource();
  }, [closeSource, openSource]);

  return { status, lastEvent, on, reconnect };
}
