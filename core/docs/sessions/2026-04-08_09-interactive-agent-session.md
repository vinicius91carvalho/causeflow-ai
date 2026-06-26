# Session: Interactive Agent — Mastra Migration Phase 1-4

**Date:** 2026-04-08 → 2026-04-09
**Duration:** ~12 hours
**Participants:** Sergio + Claude Opus 4.6

---

## Objective

Transform CauseFlow's fire-and-forget investigation agent into an interactive conversational SRE that:
1. Communicates in real-time via WebSocket during investigation
2. Asks questions to increase confidence
3. Stays alive for follow-up after investigation completes
4. Supports next-day conversation continuity via REST + Mastra Memory
5. Accepts corrections that trigger reinvestigation

---

## What Was Built

### Phase 1-3: Already Done (prior sessions)
- Mastra replaces EnhancedPTCRunner ✅
- WebSocket relay (dashboard ↔ API server ↔ Fargate worker) ✅
- Checkpoint tools (report_finding, request_confirmation, request_context) ✅

### Phase 4: Dual Memory (this session)
- **@mastra/memory + @mastra/dynamodb** installed
- DynamoDB table `causeflow-staging-memory` created (90-day TTL)
- Thread per investigation (`investigation-{incidentId}`), resource = tenantId
- Working memory template: phase, confidence, hypothesis, findings, corrections
- MastraAgentRunner dynamically loads memory, graceful fallback on IAM errors
- Worker + REST chat use same Mastra Memory thread for session continuity

### Interactive Features (this session)

| Feature | Backend | Frontend |
|---------|---------|----------|
| **Structured QuestionCard** | Checkpoint tools send `question` type with `questionId`, `options`, `timeoutMs` | Card with clickable option buttons, custom input, countdown bar |
| **Worker idle mode (30 min)** | Worker stays alive post-investigation, listens for WS guidance, runs Haiku follow-up agent | Header switches to "Follow-up Chat", input stays active |
| **REST chat fallback** | `POST/GET /v1/investigation/:id/chat` — works without worker | Auto-detects WS vs REST, loads chat history on mount |
| **Chat intent classification** | Haiku classifies: question / correction / context | Shows response inline in feed |
| **Correction → reinvestigation** | Saves to Hindsight + evidence, triggers reinvestigation | "Got it — started a new investigation with this context" |
| **Known solution skip override** | Skips known solution check when description contains `[CORRECTION]` | N/A |
| **Agent questioning instructions** | Orchestrator prompt with mandatory triggers: Phase 1 always ask, low confidence, multiple hypotheses | N/A |
| **Duplicate worker guard** | Only reinvestigates from terminal states, not from `investigating` | N/A |

### UI Changes

| Change | File |
|--------|------|
| Assigned Agents section removed | `incident-narrative.tsx` |
| SSE removed from incident detail (caused WS disconnects) | `incident-detail.tsx` |
| Polling restored (5s, only while investigating) | `incident-detail.tsx` |
| IncidentStatusPanel simplified (no stream status pill) | `incident-status-panel.tsx` |
| WS reconnect loop fixed (connect once per incidentId) | `investigation-live-feed.tsx` |

---

## Bugs Found & Fixed

### WebSocket Relay 403 (Root Cause: WAF NoUserAgent_HEADER)

**Symptom:** Worker Fargate task received 403 when connecting to relay via `wss://api-staging.causeflow.ai`.

**Investigation path:**
1. Initially suspected WAF → no sampled requests found
2. Tried internal ALB URL (`ws://`) → HTTP redirect (ALB port 80 redirects to 443)
3. Tried `wss://` ALB → TLS cert mismatch (cert for `api-staging.causeflow.ai`, not ALB hostname)
4. Added `rejectUnauthorized: false` → still 403
5. Tested with browser-like headers → 401 (passed!)
6. **Root cause:** AWS WAF `AWSManagedRulesCommonRuleSet` `NoUserAgent_HEADER` rule blocks requests without `User-Agent` header. Node.js `ws` library doesn't send one by default.

**Fix:** Added `Origin` + `User-Agent` headers to `InvestigationWSClient`.

### Relay Server Dropping Worker Messages

**Symptom:** Dashboard connected to relay but received no checkpoints.

**Root cause:** `investigation-relay-server.ts` parsed ALL messages with `parseUserMessage()` (Zod schema for user→agent types). Worker messages (`complete`, `idle`, `checkpoint`) failed Zod validation and were silently dropped.

**Fix:** Check `role` before parsing. Worker messages → `broadcastToUser()`. Dashboard messages → parse as user messages.

### Known Solution False Positive

**Symptom:** After correction, reinvestigation returned the same wrong root cause.

**Root cause:** Hindsight `reflect()` returned the old cached root cause with 0.92 confidence, skipping the full investigation.

**Fix:** Skip known solution check when incident description contains `[CORRECTION]`.

### Event Type Mismatch

**Symptom:** Feedback subscriber never received events.

**Root cause:** Use case published `investigation.feedback_recorded`, subscriber listened for `knowledge.feedback_recorded`.

**Fix:** Changed to `knowledge.feedback_recorded`.

### WS Reconnect Loop

**Symptom:** Dashboard created dozens of WS connections (~1/min).

**Root cause:** Polling updated incident state → re-render → `useEffect` with `isInProgress` dep → cleanup → reconnect.

**Fix:** `hasConnectedRef` guard — connect once per incidentId.

### REST Fallback Not Triggering

**Symptom:** Guidance sent via WS when worker was dead (relay connected but no worker).

**Root cause:** Multiple issues:
1. `isInProgress` prop included `resolved` status for UI display, making `sendGuidance` think worker was active
2. System "Connected to relay" progress message counted as evidence of worker activity

**Fix:** Only use WS when `idleRef.current` (worker confirmed alive) or `hasWorkerMessages` (actual checkpoints in feed, excluding system messages).

---

## Infrastructure Changes

| Change | Details |
|--------|---------|
| DynamoDB table | `causeflow-staging-memory` (pay-per-request, us-east-2) |
| IAM policy | `MastraMemoryAccess` on `causeflow-staging-ecs-task` role |
| WAF rule | `AllowInvestigationWS` (priority 0) — allows `/v1/investigation/ws` path |
| ECS task def | Rev 67: `INVESTIGATION_RELAY_URL_INTERNAL = wss://api-staging.causeflow.ai/v1/investigation/ws` |
| npm packages | `@mastra/memory@1.15.0`, `@mastra/dynamodb@1.0.3` |

---

## Commits

### Backend (causeflow/causeflow) — 14 commits
```
5eab3bb fix: allow reinvestigation from triaging status
b00974b fix: graceful memory fallback — retry without memory on IAM errors
3ba4c9d fix: relay server broadcasts worker messages + skip known solution on corrections
054bf0c fix: add User-Agent header to WS client — WAF NoUserAgent_HEADER rule
d55e862 fix: add Origin header to WS client — WAF blocks requests without it
7e948f9 fix: skip TLS hostname check for internal ALB relay connections
713151d fix: prevent duplicate investigation workers on rapid corrections
57c0d2e feat: Phase 4 — Mastra Memory with DynamoDB for investigation sessions
2b672f6 fix: improve chat intent classifier — bias toward correction over context
3178533 feat: chat intent classification — corrections trigger reinvestigation
49f8d80 fix: use internal ALB URL for worker→relay WebSocket connection
5bafccd feat: interactive investigation — idle mode, REST chat, structured questions
```

### Frontend (causeflow/web) — 11 commits
```
c012fdd fix: prevent WS reconnect loop — connect once per incidentId
9c437ac fix: system 'Connected to relay' message should not trigger WS routing
b461874 fix: remove SSE from incident detail — was causing WS relay disconnects
2c20e6e fix: only use WS for guidance when worker is confirmed alive
b7d2ccc fix: remove Assigned Agents from incident detail UI
267b695 fix: use REST fallback when WS connected to relay but worker is dead
0b1e386 fix: update live-feed smoke test for REST chat fallback
98fcc08 feat: interactive investigation UI — QuestionCard, idle mode, REST chat fallback
```

---

## Files Changed

### Backend — New Files
- `src/modules/investigation/application/chat-investigation.usecase.ts` — REST chat with intent classification
- `src/shared/infra/memory/mastra-memory-factory.ts` — Mastra Memory + DynamoDB singleton

### Backend — Modified Files
- `src/bootstrap.ts` — wire ChatInvestigationUseCase + Mastra Memory
- `src/modules/investigation/application/agent-configs.ts` — stronger questioning instructions
- `src/modules/investigation/application/investigate-incident.usecase.ts` — skip known solution on corrections, pass memory
- `src/modules/investigation/application/record-investigation-feedback.usecase.ts` — DynamoDB persistence + event type fix
- `src/modules/investigation/application/add-investigation-context.usecase.ts` — reinvestigation guards
- `src/modules/investigation/infra/checkpoint-tools.ts` — structured question messages
- `src/modules/investigation/infra/investigation.routes.ts` — GET/POST feedback + chat routes
- `src/modules/investigation/domain/investigation.types.ts` — memory config in InvestigationInput
- `src/shared/application/ports/agent-runner.port.ts` — memory option in AgentRunConfig
- `src/shared/application/ports/investigation-channel.port.ts` — sendQuestion method
- `src/shared/infra/llm/mastra-agent-runner.ts` — Mastra Memory integration + graceful fallback
- `src/shared/infra/relay/investigation-relay-protocol.ts` — idle, followup message types
- `src/shared/infra/relay/investigation-relay-server.ts` — broadcast worker messages correctly
- `src/shared/infra/relay/investigation-ws-client.ts` — Origin + User-Agent headers, sendQuestion/sendIdle/sendFollowup
- `src/shared/infra/ecs/task-dispatcher.ts` — INVESTIGATION_RELAY_URL_INTERNAL
- `src/workers/investigation-worker.ts` — idle mode, follow-up agent, memory config

### Frontend — New Files
- `apps/dashboard/src/app/api/investigation/[id]/chat/route.ts` — BFF proxy for REST chat

### Frontend — Modified Files
- `apps/dashboard/src/contexts/investigation/presentation/components/investigation-live-feed.tsx` — QuestionCard, idle mode, REST fallback, WS routing fixes
- `apps/dashboard/src/contexts/investigation/presentation/components/incident-detail.tsx` — SSE removed, polling restored
- `apps/dashboard/src/contexts/investigation/presentation/components/incident-detail/incident-status-panel.tsx` — simplified (no stream status)
- `apps/dashboard/src/contexts/investigation/presentation/components/incident-detail/incident-narrative.tsx` — removed Assigned Agents

---

## Remaining Issues

| Issue | Priority | Details |
|-------|----------|---------|
| **Live checkpoints not verified E2E** | 🔴 High | Relay broadcasts fixed but not tested with a full investigation that uses checkpoint tools |
| **Mastra Memory DynamoDB init** | 🟡 Medium | IAM fixed, graceful fallback added, but not validated that messages persist |
| **Cost validation** | 🟡 Medium | Prompt caching with Mastra Memory may change token usage |
| **Relay timing** | 🟡 Medium | Worker can finish before dashboard opens the page |
| **WS reconnect** | 🟢 Fixed | `hasConnectedRef` guard deployed, needs validation |

---

## Architecture (Final State)

```
┌─────────────┐     WSS      ┌──────────────┐     WSS      ┌──────────────┐
│  Dashboard   │◄────────────►│  API Server   │◄────────────►│ Fargate Worker│
│  (Browser)   │              │  (Relay)      │              │ (Investigation)│
└──────┬───────┘              └──────┬────────┘              └──────┬────────┘
       │                             │                              │
       │  REST (fallback)            │                              │
       │  POST /investigation/:id/chat                              │
       └────────────────────────────►│                              │
                                     │                              │
                              ┌──────┴────────┐              ┌──────┴────────┐
                              │   DynamoDB     │              │  Mastra Memory │
                              │ causeflow-stg  │              │ causeflow-stg- │
                              │ (incidents,    │              │ memory (threads,│
                              │  evidence,     │              │  messages,      │
                              │  feedback)     │              │  working mem)   │
                              └───────────────┘              └────────────────┘
                                     │
                              ┌──────┴────────┐
                              │   Hindsight    │
                              │ (long-term     │
                              │  cross-invest  │
                              │  memory)       │
                              └───────────────┘

3 Modes of Chat:
├── During investigation: WS (real-time checkpoints, questions, guidance)
├── Post-investigation (30 min): WS idle mode (Haiku follow-up)
└── Next day: REST chat (Haiku + DynamoDB context + Hindsight + Mastra Memory)
```
