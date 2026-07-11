'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  type CompletionData,
  type FeedItem,
  HYPOTHESIS_MUTATING_STAGES,
  type HypothesisMutatingStage,
  type RecommendedAction,
} from '../../domain/feed-types';
import { getRelayWsUrl, isPhaseStage, PHASE_LABELS } from '../lib/feed-constants';

const HYPOTHESIS_STAGE_SET = new Set<string>(HYPOTHESIS_MUTATING_STAGES);

export function useInvestigationFeed(options: {
  incidentId: string;
  isInProgress: boolean;
  onStatusChange?: () => void;
  onConnectionChange?: (connected: boolean) => void;
  onHypothesisProgress?: (stage: HypothesisMutatingStage) => void;
}) {
  const { incidentId, isInProgress, onStatusChange, onConnectionChange, onHypothesisProgress } =
    options;

  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [connected, setConnected] = useState(false);
  const [idle, setIdle] = useState(false);
  /**
   * State of the Fargate worker backing this investigation session.
   * - null: we haven't heard from the relay yet
   * - 'no_worker': no worker alive; first guidance will dispatch one
   * - 'provisioning': relay has dispatched a followup worker; ~30-60s to ready
   * - 'ready': worker is connected and will process guidance immediately
   * - 'disconnected': worker dropped (idle timeout, crash) — next guidance re-dispatches
   */
  const [workerStatus, setWorkerStatus] = useState<
    'no_worker' | 'provisioning' | 'ready' | 'disconnected' | null
  >(null);
  const wsRef = useRef<WebSocket | null>(null);
  const idleRef = useRef(false);
  const workerStatusRef = useRef<typeof workerStatus>(null);
  /** Messages queued while workerStatus !== 'ready' — flushed as a batch on ready. */
  const pendingQueueRef = useRef<string[]>([]);
  const feedContainerRef = useRef<HTMLDivElement>(null);
  const hasConnectedRef = useRef(false);

  // Auto-scroll feed container when new items arrive
  // biome-ignore lint/correctness/useExhaustiveDependencies: feed is the intentional trigger
  useEffect(() => {
    const el = feedContainerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [feed]);

  // Connect to WebSocket relay for every incident (active or idle). The server tells us
  // via worker_status whether a worker is alive; first guidance dispatches one on demand.
  useEffect(() => {
    if (hasConnectedRef.current || (wsRef.current && wsRef.current.readyState <= WebSocket.OPEN))
      return;
    hasConnectedRef.current = true;

    let ws: WebSocket | null = null;
    let cancelled = false;

    async function connect() {
      try {
        const tokenRes = await fetch(
          `/api/investigation/${encodeURIComponent(incidentId)}/relay-token`,
        );
        if (!tokenRes.ok || cancelled) return;
        const { token, relayUrl } = (await tokenRes.json()) as { token: string; relayUrl: string };

        const wsUrl = getRelayWsUrl(relayUrl, token, incidentId);
        if (!wsUrl || cancelled) return;

        ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          if (!cancelled) {
            setConnected(true);
            onConnectionChange?.(true);
          }
        };

        ws.onmessage = (event) => {
          try {
            const msg = JSON.parse(event.data as string) as {
              type: string;
              finding?: string;
              message?: string;
              stage?: string;
              rootCause?: string;
              summary?: string;
              expiresAt?: string;
              timestamp?: string;
              questionId?: string;
              question?: string;
              options?: string[];
              timeoutMs?: number;
              severity?: 'low' | 'medium' | 'high' | 'critical' | 'info' | 'warning';
              category?: string;
              recommendedActions?: RecommendedAction[];
              status?: 'no_worker' | 'provisioning' | 'ready' | 'disconnected' | string;
              costUsd?: number;
              durationMs?: number;
              agentsUsed?: string[];
              context?: {
                title?: string;
                description?: string;
                rootCause?: string;
                status?: string;
                severity?: string;
              };
              toolName?: string;
              input?: Record<string, unknown>;
              evidenceId?: string;
              evidenceType?: string;
              agentRole?: string;
              content?: string;
            };

            if (msg.type === 'worker_status') {
              const status = msg.status as
                | 'no_worker'
                | 'provisioning'
                | 'ready'
                | 'disconnected'
                | undefined;
              if (!status) return;
              setWorkerStatus(status);
              workerStatusRef.current = status;
              // When the worker comes online, flush any buffered guidance as a single batch.
              if (
                status === 'ready' &&
                pendingQueueRef.current.length > 0 &&
                wsRef.current?.readyState === WebSocket.OPEN
              ) {
                const queued = pendingQueueRef.current.join('\n\n---\n\n');
                pendingQueueRef.current = [];
                wsRef.current.send(
                  JSON.stringify({ type: 'guidance', incidentId, message: queued }),
                );
              }
              return;
            }

            if (msg.type === 'complete') {
              const completionSeverity =
                msg.severity && ['low', 'medium', 'high', 'critical'].includes(msg.severity)
                  ? (msg.severity as CompletionData['severity'])
                  : undefined;
              const completion: CompletionData = {
                rootCause: msg.rootCause,
                severity: completionSeverity,
                recommendedActions: msg.recommendedActions,
                status: msg.status,
                costUsd: msg.costUsd,
                durationMs: msg.durationMs,
                agentsUsed: msg.agentsUsed,
              };
              setFeed((prev) => [
                ...prev,
                {
                  id: `${Date.now()}-complete`,
                  type: 'complete',
                  message: msg.rootCause ?? 'Investigation complete',
                  timestamp: msg.timestamp ?? new Date().toISOString(),
                  completion,
                },
              ]);
              onStatusChange?.();
              return;
            }

            if (msg.type === 'idle') {
              setIdle(true);
              idleRef.current = true;
              setFeed((prev) => [
                ...prev,
                {
                  id: `${Date.now()}-idle`,
                  type: 'idle',
                  message: msg.summary ?? 'Agent available for follow-up questions (30 min)',
                  timestamp: msg.timestamp ?? new Date().toISOString(),
                },
              ]);
              return;
            }

            if (msg.type === 'followup') {
              setFeed((prev) => [
                ...prev,
                {
                  id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                  type: 'followup',
                  message: msg.message ?? '',
                  timestamp: msg.timestamp ?? new Date().toISOString(),
                },
              ]);
              return;
            }

            if (msg.type === 'question') {
              setFeed((prev) => [
                ...prev,
                {
                  id: msg.questionId ?? `${Date.now()}-q`,
                  type: 'question',
                  message: msg.question ?? '',
                  timestamp: msg.timestamp ?? new Date().toISOString(),
                  questionId: msg.questionId,
                  options: msg.options,
                  timeoutMs: msg.timeoutMs,
                },
              ]);
              return;
            }

            if (msg.type === 'tool_call') {
              setFeed((prev) => [
                ...prev,
                {
                  id: `${Date.now()}-tc-${Math.random().toString(36).slice(2, 6)}`,
                  type: 'tool_call',
                  message: `Calling ${msg.toolName}`,
                  toolName: msg.toolName,
                  toolInput: msg.input,
                  timestamp: msg.timestamp ?? new Date().toISOString(),
                },
              ]);
              return;
            }

            if (msg.type === 'evidence') {
              const metadata = (msg as { metadata?: Record<string, unknown> }).metadata;
              const maskingRaw = metadata?.masking as
                | {
                    totalFields?: number;
                    detections?: Array<{ detector?: string; count?: number }>;
                  }
                | undefined;
              const masking =
                maskingRaw && typeof maskingRaw.totalFields === 'number'
                  ? {
                      totalFields: maskingRaw.totalFields,
                      detections: Array.isArray(maskingRaw.detections)
                        ? maskingRaw.detections
                            .filter(
                              (d): d is { detector: string; count: number } =>
                                typeof d?.detector === 'string' && typeof d?.count === 'number',
                            )
                            .map((d) => ({ detector: d.detector, count: d.count }))
                        : [],
                    }
                  : undefined;
              setFeed((prev) => [
                ...prev,
                {
                  id: msg.evidenceId ?? `${Date.now()}-ev`,
                  type: 'evidence',
                  message: msg.content ?? 'Evidence collected',
                  evidenceType: msg.evidenceType,
                  agentRole: msg.agentRole,
                  label: metadata?.label as string | undefined,
                  memoriesFound:
                    typeof metadata?.memoriesFound === 'number'
                      ? metadata.memoriesFound
                      : undefined,
                  skippedInvestigation: metadata?.skippedInvestigation === true,
                  masking,
                  toolCallId:
                    typeof metadata?.toolCallId === 'string' ? metadata.toolCallId : undefined,
                  claim: typeof metadata?.claim === 'string' ? metadata.claim : undefined,
                  quote: typeof metadata?.quote === 'string' ? metadata.quote : undefined,
                  toolName: typeof metadata?.toolName === 'string' ? metadata.toolName : undefined,
                  timestamp: msg.timestamp ?? new Date().toISOString(),
                },
              ]);
              return;
            }

            if (msg.type === 'checkpoint' && msg.stage === 'finding' && msg.finding) {
              const findingItem: FeedItem = {
                id: `${Date.now()}-f-${Math.random().toString(36).slice(2, 6)}`,
                type: 'checkpoint',
                message: msg.finding,
                severity: (msg.severity as FeedItem['severity']) ?? 'info',
                category: msg.category ?? 'general',
                timestamp: msg.timestamp ?? new Date().toISOString(),
              };
              setFeed((prev) => [...prev, findingItem]);
              return;
            }

            if (msg.type === 'progress' && msg.stage) {
              // Fire a hypothesis-set mutation signal so views that render
              // Hypothesis entities can refetch mid-investigation instead
              // of waiting for the final status transition.
              if (HYPOTHESIS_STAGE_SET.has(msg.stage)) {
                onHypothesisProgress?.(msg.stage as HypothesisMutatingStage);
              }

              if (msg.stage === 'capabilities_ready' && msg.message) {
                try {
                  const capData = JSON.parse(msg.message) as { capabilities?: string[] };
                  if (capData.capabilities) {
                    setFeed((prev) => [
                      ...prev,
                      {
                        id: `${Date.now()}-caps`,
                        type: 'capabilities',
                        message: '',
                        capabilities: capData.capabilities,
                        timestamp: msg.timestamp ?? new Date().toISOString(),
                      },
                    ]);
                    return;
                  }
                } catch {
                  /* fall through to default */
                }
              }

              if (msg.stage === 'tool_error' && msg.message) {
                const toolErrorMsg = msg.message;
                setFeed((prev) => [
                  ...prev,
                  {
                    id: `${Date.now()}-te-${Math.random().toString(36).slice(2, 6)}`,
                    type: 'tool_error',
                    message: toolErrorMsg,
                    timestamp: msg.timestamp ?? new Date().toISOString(),
                  },
                ]);
                return;
              }

              if (isPhaseStage(msg.stage)) {
                setFeed((prev) => [
                  ...prev,
                  {
                    id: `${Date.now()}-phase-${msg.stage}`,
                    type: 'phase',
                    message: PHASE_LABELS[msg.stage!] ?? msg.stage!,
                    timestamp: msg.timestamp ?? new Date().toISOString(),
                  },
                ]);
                if (!msg.message || msg.message.startsWith('{')) return;
              }
            }

            const item: FeedItem = {
              id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              type: msg.type as FeedItem['type'],
              message: msg.finding ?? msg.message ?? '',
              timestamp: msg.timestamp ?? new Date().toISOString(),
            };

            if (item.message) {
              setFeed((prev) => [...prev, item]);
            }
          } catch {
            /* ignore malformed messages */
          }
        };

        ws.onclose = () => {
          if (!cancelled) {
            setConnected(false);
            onConnectionChange?.(false);
            if (idleRef.current) {
              setFeed((prev) => [
                ...prev,
                {
                  id: `${Date.now()}-disconnect`,
                  type: 'progress',
                  message: 'Agent disconnected — follow-up session ended',
                  timestamp: new Date().toISOString(),
                },
              ]);
              setIdle(false);
              idleRef.current = false;
            }
            onStatusChange?.();
          }
          wsRef.current = null;
        };

        ws.onerror = (err) => {
          if (!cancelled) {
            setConnected(false);
            onConnectionChange?.(false);
            setFeed((prev) => [
              ...prev,
              {
                id: `${Date.now()}-error`,
                type: 'error',
                message: `Relay connection failed: ${err instanceof ErrorEvent ? err.message : 'WebSocket error'}`,
                timestamp: new Date().toISOString(),
              },
            ]);
          }
        };
      } catch (err) {
        if (!cancelled) {
          setFeed((prev) => [
            ...prev,
            {
              id: `${Date.now()}-error`,
              type: 'error',
              message: `Relay setup failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
              timestamp: new Date().toISOString(),
            },
          ]);
        }
      }
    }

    void connect();

    return () => {
      cancelled = true;
      hasConnectedRef.current = false;
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
      wsRef.current = null;
      setConnected(false);
    };
  }, [incidentId, onConnectionChange, onHypothesisProgress, onStatusChange]);

  // Load investigation history on mount
  useEffect(() => {
    async function loadHistory() {
      const items: FeedItem[] = [];

      try {
        const detailRes = await fetch(
          `/api/investigation/${encodeURIComponent(incidentId)}/detail`,
        );
        if (detailRes.ok) {
          const detail = (await detailRes.json()) as {
            evidenceByAgent: Record<
              string,
              Array<{
                evidenceId: string;
                agentRole: string;
                evidenceType: string;
                content: string;
                toolCallId?: string;
                claim?: string;
                quote?: string;
                metadata?: { label?: string; toolName?: string };
                createdAt: string;
              }>
            >;
          };
          for (const [agentRole, evidences] of Object.entries(detail.evidenceByAgent)) {
            for (const ev of evidences) {
              items.push({
                id: ev.evidenceId,
                type: 'evidence',
                message: ev.content,
                evidenceType: ev.evidenceType,
                agentRole,
                label: ev.metadata?.label,
                toolName: ev.metadata?.toolName,
                toolCallId: ev.toolCallId,
                claim: ev.claim,
                quote: ev.quote,
                timestamp: ev.createdAt,
              });
            }
          }
        }
      } catch {
        /* ignore — evidence is best-effort */
      }

      try {
        const chatRes = await fetch(`/api/investigation/${encodeURIComponent(incidentId)}/chat`);
        if (chatRes.ok) {
          const data = (await chatRes.json()) as {
            messages: Array<{ role: string; content: string; createdAt: string }>;
          };
          for (const [i, m] of data.messages.entries()) {
            items.push({
              id: `history-${i}`,
              type: m.role === 'user' ? 'guidance' : 'followup',
              message: m.content,
              timestamp: m.createdAt,
            });
          }
        }
      } catch {
        /* ignore */
      }

      if (items.length > 0) {
        items.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
        setFeed((prev) => (prev.length === 0 ? items : prev));
      }
    }
    void loadHistory();
  }, [incidentId]);

  const sendGuidance = useCallback(
    async (msg: string) => {
      if (!msg.trim()) return;
      const trimmed = msg.trim();

      // Optimistic local render so the user sees what they typed immediately.
      setFeed((prev) => [
        ...prev,
        {
          id: `${Date.now()}-guidance`,
          type: 'guidance',
          message: trimmed,
          timestamp: new Date().toISOString(),
        },
      ]);

      const ws = wsRef.current;
      const wsOpen = ws && ws.readyState === WebSocket.OPEN;
      const status = workerStatusRef.current;

      if (wsOpen && status === 'ready') {
        // Worker is alive — send immediately.
        ws.send(JSON.stringify({ type: 'guidance', incidentId, message: trimmed }));
        return;
      }

      // When the live worker WS is unavailable, fall back to Core investigation chat
      // (AC-060): POST /api/investigation/:id/chat → model-backed reply, not fixtures.
      if (!wsOpen || status === 'no_worker' || status === 'disconnected' || status === null) {
        try {
          const res = await fetch(`/api/investigation/${encodeURIComponent(incidentId)}/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: trimmed }),
          });
          if (res.ok) {
            const data = (await res.json()) as { response?: string };
            const reply =
              typeof data.response === 'string' && data.response.trim()
                ? data.response.trim()
                : null;
            if (reply) {
              setFeed((prev) => [
                ...prev,
                {
                  id: `${Date.now()}-followup`,
                  type: 'followup',
                  message: reply,
                  timestamp: new Date().toISOString(),
                },
              ]);
              return;
            }
          }
        } catch {
          /* fall through to WS buffer / dispatch path */
        }
      }

      // Worker is provisioning or REST chat failed — buffer and trigger dispatch.
      // The relay reacts to the 'guidance' message by dispatching a followup worker and
      // emitting worker_status: provisioning. The buffered messages are flushed as a
      // single batch once worker_status: ready arrives (see onmessage handler above).
      pendingQueueRef.current.push(trimmed);

      if (wsOpen && (status === null || status === 'no_worker' || status === 'disconnected')) {
        // Send a lightweight trigger so the server knows to dispatch. The guidance text
        // itself is held locally in pendingQueueRef and will be flushed on 'ready'.
        ws.send(JSON.stringify({ type: 'guidance', incidentId, message: '' }));
      }
      // If ws isn't open yet (initial mount), the queue will drain when onopen → register
      // → server sends worker_status. Nothing more to do here.
    },
    [incidentId],
  );

  const sendAnswer = useCallback(
    (questionId: string, answer: string) => {
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
      wsRef.current.send(
        JSON.stringify({
          type: 'answer',
          incidentId,
          questionId,
          answer,
        }),
      );
      setFeed((prev) =>
        prev.map((item) => (item.questionId === questionId ? { ...item, answered: true } : item)),
      );
      setFeed((prev) => [
        ...prev,
        {
          id: `${Date.now()}-answer`,
          type: 'guidance',
          message: answer,
          timestamp: new Date().toISOString(),
        },
      ]);
    },
    [incidentId],
  );

  const canChat = isInProgress || idle || !connected;

  const completionItem = feed.find((f) => f.type === 'complete' && f.completion) ?? null;

  // "sending" now means the user's message is buffered waiting for the worker to come online
  // (first message after idle death) or that a worker is actively being provisioned.
  const sending = workerStatus === 'provisioning';

  return {
    feed,
    connected,
    idle,
    sending,
    workerStatus,
    canChat,
    completionItem,
    feedContainerRef,
    sendGuidance,
    sendAnswer,
  };
}
