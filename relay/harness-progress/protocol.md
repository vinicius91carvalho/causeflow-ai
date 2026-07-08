# protocol workflow journal

## WI-AC-017 — Verify-first (protocol)

**Result: implementation=true (zero-diff checkpoint — no code changes)**

WorkItem: WI-AC-017 — verify AC-017 (JSON-RPC 2.0 `list_resources` returns `{ resourceId, type, name, database, readOnly: true }[]` via `createResponse(request.id, resources)`) against the existing code at a real WebSocket boundary.

Boundary: real `ws.WebSocketServer` stub control-plane on `127.0.0.1:5189/v1/relay/connect` (`scripts/probe-ac017.mjs`) + the real compiled relay `node dist/index.js` started from a `relay-config.yaml` pointing at the stub with two resources (`order-pg` postgres, `order-mongo` mongodb, both `database: orders`). No mocks of the relay. Build: `npx tsc --noEmit` → 0; `npm run build` → 0.

Flow exercised at the real external boundary:
- Relay boots → loads config → initializes both drivers (drivers never connect to real DBs for this AC; `list_resources` does not touch drivers) → opens WS to stub with `?token=ac017-token&tenantId=ac017-tenant`.
- Stub accepts the relay handshake, validates `token` + `tenantId` from the query string (both match), and on receiving the relay's `resource_update` (sent on `open`) replies with a JSON-RPC 2.0 `list_resources` request (no params: `{ jsonrpc:'2.0', id:'req-ac017-1', method:'list_resources', params:{} }`).
- Relay dispatches `list_resources` → `policyEngine.listResources().map(r => ({ resourceId: r.id, type: r.type, name: r.name, database: String(r.connection['database'] ?? ''), readOnly: true }))` → `wsClient.send(createResponse(request.id, resources))`.

Probe verdict (`scripts/probe-ac017.mjs`, `passed: true` — all 16 checks green):
- `relayConnected=true`, `tokenOk=true`, `tenantOk=true` (relay authenticated to stub via query string).
- `listResourcesSent=true` (stub sent the `list_resources` request after the connect-time `resource_update`).
- `responseReceived=true`, `jsonrpcOk=true` (`jsonrpc: '2.0'`), `idMatches=true` (`id: 'req-ac017-1'` echoed back).
- `resultIsArray=true`, `resourceCountOk=true` (2 resources), `allResourcesMapped=true` (ids `order-pg`, `order-mongo` both present, sorted match).
- `perResourceShapeOk=true` (each entry has exactly the keys `['database','name','readOnly','resourceId','type']` — no extra/missing keys).
- `readOnlyOk=true` (every entry `readOnly === true`), `typeOk=true` (`postgres` | `mongodb`), `databaseOk=true` (`orders`), `nameOk=true` (`Order Service PostgreSQL` / `Order Service MongoDB`).
- `helperShapeOk=true` (the relay's `createResponse(id, resources)` output is shape-equivalent to `{ jsonrpc:'2.0', id, result:[...] }` with the documented per-resource keys).

Raw response captured by the probe:
```json
{
  "jsonrpc": "2.0",
  "id": "req-ac017-1",
  "result": [
    { "resourceId": "order-pg",   "type": "postgres", "name": "Order Service PostgreSQL", "database": "orders", "readOnly": true },
    { "resourceId": "order-mongo","type": "mongodb",  "name": "Order Service MongoDB",    "database": "orders", "readOnly": true }
  ]
}
```

Source checks (`src/index.ts` `list_resources` case + `src/transport/protocol.ts` + `src/policy/policy-engine.ts`):
- Handler maps `policyEngine.listResources()` (the policy engine's resource list, built from `config.resources` at startup) to `{ resourceId: r.id, type: r.type, name: r.name, database: String(r.connection['database'] ?? ''), readOnly: true }` and sends via `createResponse(request.id, resources)`.
- `createResponse(id, result)` returns `{ jsonrpc: '2.0', id, result }` (no `error` key, no extra fields).
- `readOnly` is hardcoded `true` for every resource (read-only is enforced at the driver/policy/SQL layers, never surfaced as anything but `true` to the control plane).

AC-017 contract satisfied at the real boundary on integrated main. No defects found. No code changes (zero-diff checkpoint).

## 2026-07-08T08:25Z — Checkpoint ready

- Attempt: 1/3
- WorkItem: WI-AC-017
- AcceptanceChecks: AC-017
- Outcome: passed on integrated main (zero-diff checkpoint, implementation=true)
- Evidence: /tmp/ac017-probe.log (probe verdict) + /tmp/ac017-relay.log (relay boot + connect log)
- NextAction: next Ready Work Item

## 2026-07-08T08:31Z — QA independent re-audit (WI-AC-017)

- Role: qa-agent. Independent re-test at the real WebSocket boundary on the integrated worktree.
- Boundary: real `ws.WebSocketServer` stub on `127.0.0.1:5189/v1/relay/connect` (env PORT=5189) + real compiled relay `node dist/index.js` (build `npm run build` → exit 0). Config `relay-config.yaml` with two resources (`order-pg` postgres, `order-mongo` mongodb, `database: orders`). No relay mocks.
- Flow: relay boots → opens WS with `?token=qa-token&tenantId=qa-tenant` → sends `resource_update` (resources=2) → stub replies with JSON-RPC 2.0 `list_resources` request carrying NO `params` key (per AC "no params") → relay dispatches via `policyEngine.listResources().map(...)` → `wsClient.send(createResponse(request.id, resources))`.
- Captured response:
  ```json
  {"jsonrpc":"2.0","id":"b755726c-1623-434f-8cad-1d9df806fedc","result":[{"resourceId":"order-pg","type":"postgres","name":"Order Service PostgreSQL","database":"orders","readOnly":true},{"resourceId":"order-mongo","type":"mongodb","name":"Order Service MongoDB","database":"orders","readOnly":true}]}
  ```
- Verdict: jsonrpc='2.0'; id echoed; result is array of 2; every entry shaped exactly `{resourceId,type,name,database,readOnly:true}`; no `error` key; readOnly===true for all; types `postgres`|`mongodb`; derived from policy engine resource list (`listResources()` → `config.resources`). All checks green.
- Outcome: qa=true, implementation=true, defects=none. Zero code changes (independent audit of already-integrated main).

## 2026-07-08T11:30:26.518Z — Checkpoint ready

- Attempt: 1/3
- WorkItem: WI-AC-017
- Outcome: isolated QA passed
- NextAction: Integrated Verification

## 2026-07-08T12:16:37.523Z — Resumed

- WorkItem: WI-AC-017
- PreviousPhase: qa
- Attempt: 1
- NextAction: qa

## 2026-07-08T12:16:37.560Z — Checkpoint ready

- Attempt: 1/3
- WorkItem: WI-AC-017
- Outcome: isolated QA passed
- NextAction: Integrated Verification

## 2026-07-08T12:23:42.220Z — Blocked Work Item

- Attempt: 1/3
- WorkItem: WI-AC-017
- Outcome: integration could not complete
- Defects: error: Unable to create '/home/vinicius/projects/causeflow-ai/.git/index.lock': File exists.

Another git process seems to be running in this repository, e.g.
an editor opened by 'git commit'. Please make sure all processes
are terminated then try again. If it still fails, a git process
may have crashed in this repository earlier:
remove the file manually to continue.
fatal: Unable to write index.
- NextAction: User reviews evidence and explicitly resumes with guidance

## 2026-07-08T13:05:00.200Z — Explicit Resume

- WorkItem: WI-AC-017
- Outcome: user authorized a new Attempt cycle
- Guidance: Transient merge-lock contention from a period of unusually high concurrent load (~80min ago), not a data problem -- system is calmer now. Fresh retry.
- NextAction: Coding Attempt 1

## 2026-07-08T13:05:02.607Z — Blocked Work Item

- Attempt: 1/3
- WorkItem: WI-AC-017
- Outcome: coding agent failed three times
- Defects: 402: {"message":"This request requires more credits, or fewer max_tokens. You requested up to 32768 tokens, but can only afford 3875. To increase, visit https://openrouter.ai/settings/credits and add more credits","code":402,"metadata":{"provider_name":null,"previous_errors":[{"code":402,"message":"This request requires more credits, or fewer max_tokens. You requested up to 32768 tokens, but can only afford 5536. To increase, visit https://openrouter.ai/settings/credits and add more credits"},{"code":402,"message":"This request requires more credits, or fewer max_tokens. You requested up to 32768 tokens, but can only afford 5536. To increase, visit https://openrouter.ai/settings/credits and add more credits"},{"code":402,"message":"This request requires more credits, or fewer max_tokens. You requested up to 32768 tokens, but can only afford 4559. To increase, visit https://openrouter.ai/settings/credits and add more credits"},{"code":402,"message":"This request requires more credits, or fewer max_tokens. You requested up to 32768 tokens, but can only afford 4305. To increase, visit https://openrouter.ai/settings/credits and add more credits"},{"code":402,"message":"This request requires more credits, or fewer max_tokens. You requested up to 32768 tokens, but can only afford 4167. To increase, visit https://openrouter.ai/settings/credits and add more credits"},{"code":402,"message":"This request requires more credits, or fewer max_tokens. You requested up to 32768 tokens, but can only afford 4113. To increase, visit https://openrouter.ai/settings/credits and add more credits"},{"code":402,"message":"This request requires more credits, or fewer max_tokens. You requested up to 32768 tokens, but can only afford 3875. To increase, visit https://openrouter.ai/settings/credits and add more credits"},{"code":402,"message":"This request requires more credits, or fewer max_tokens. You requested up to 32768 tokens, but can only afford 3875. To increase, visit https://openrouter.ai/settings/credits and add more credits"},{"code":402,"message":"This request requires more credits, or fewer max_tokens. You requested up to 32768 tokens, but can only afford 3875. To increase, visit https://openrouter.ai/settings/credits and add more credits"},{"code":402,"message":"This request requires more credits, or fewer max_tokens. You requested up to 32768 tokens, but can only afford 3875. To increase, visit https://openrouter.ai/settings/credits and add more credits"},{"code":402,"message":"This request requires more credits, or fewer max_tokens. You requested up to 32768 tokens, but can only afford 3875. To increase, visit https://openrouter.ai/settings/credits and add more credits"},{"code":402,"message":"This request requires more credits, or fewer max_tokens. You requested up to 32768 tokens, but can only afford 3875. To increase, visit https://openrouter.ai/settings/credits and add more credits"},{"code":402,"message":"This request requires more credits, or fewer max_tokens. You requested up to 32768 tokens, but can only afford 3875. To increase, visit https://openrouter.ai/settings/credits and add more credits"},{"code":402,"message":"This request requires more credits, or fewer max_tokens. You requested up to 32768 tokens, but can only afford 3757. To increase, visit https://openrouter.ai/settings/credits and add more credits"},{"code":402,"message":"This request requires more credits, or fewer max_tokens. You requested up to 32768 tokens, but can only afford 2583. To increase, visit https://openrouter.ai/settings/credits and add more credits"},{"code":402,"message":"This request requires more credits, or fewer max_tokens. You requested up to 32768 tokens, but can only afford 5683. To increase, visit https://openrouter.ai/settings/credits and add more credits"},{"code":402,"message":"This request requires more credits, or fewer max_tokens. You requested up to 32768 tokens, but can only afford 5536. To increase, visit https://openrouter.ai/settings/cr... [truncated 2020 chars]
- NextAction: User reviews evidence and explicitly resumes with guidance

## 2026-07-08T13:05:05.598Z — Explicit Resume

- WorkItem: WI-AC-017
- Outcome: user authorized a new Attempt cycle
- Guidance: This .git/index.lock collision was self-inflicted by overlapping/parallel git tool calls within the MERGE/INTEGRATION_QA agent itself, not a real conflict -- the orchestrator prompt now explicitly warns against running git commands in parallel (synced fix). Fresh retry.
- NextAction: Coding Attempt 1

## 2026-07-08T13:05:07.896Z — Blocked Work Item

- Attempt: 1/3
- WorkItem: WI-AC-017
- Outcome: coding agent failed three times
- Defects: 402: {"message":"This request requires more credits, or fewer max_tokens. You requested up to 32768 tokens, but can only afford 3875. To increase, visit https://openrouter.ai/settings/credits and add more credits","code":402,"metadata":{"provider_name":null,"previous_errors":[{"code":402,"message":"This request requires more credits, or fewer max_tokens. You requested up to 32768 tokens, but can only afford 5536. To increase, visit https://openrouter.ai/settings/credits and add more credits"},{"code":402,"message":"This request requires more credits, or fewer max_tokens. You requested up to 32768 tokens, but can only afford 5536. To increase, visit https://openrouter.ai/settings/credits and add more credits"},{"code":402,"message":"This request requires more credits, or fewer max_tokens. You requested up to 32768 tokens, but can only afford 4559. To increase, visit https://openrouter.ai/settings/credits and add more credits"},{"code":402,"message":"This request requires more credits, or fewer max_tokens. You requested up to 32768 tokens, but can only afford 4305. To increase, visit https://openrouter.ai/settings/credits and add more credits"},{"code":402,"message":"This request requires more credits, or fewer max_tokens. You requested up to 32768 tokens, but can only afford 4167. To increase, visit https://openrouter.ai/settings/credits and add more credits"},{"code":402,"message":"This request requires more credits, or fewer max_tokens. You requested up to 32768 tokens, but can only afford 4113. To increase, visit https://openrouter.ai/settings/credits and add more credits"},{"code":402,"message":"This request requires more credits, or fewer max_tokens. You requested up to 32768 tokens, but can only afford 3875. To increase, visit https://openrouter.ai/settings/credits and add more credits"},{"code":402,"message":"This request requires more credits, or fewer max_tokens. You requested up to 32768 tokens, but can only afford 3875. To increase, visit https://openrouter.ai/settings/credits and add more credits"},{"code":402,"message":"This request requires more credits, or fewer max_tokens. You requested up to 32768 tokens, but can only afford 3875. To increase, visit https://openrouter.ai/settings/credits and add more credits"},{"code":402,"message":"This request requires more credits, or fewer max_tokens. You requested up to 32768 tokens, but can only afford 3875. To increase, visit https://openrouter.ai/settings/credits and add more credits"},{"code":402,"message":"This request requires more credits, or fewer max_tokens. You requested up to 32768 tokens, but can only afford 3875. To increase, visit https://openrouter.ai/settings/credits and add more credits"},{"code":402,"message":"This request requires more credits, or fewer max_tokens. You requested up to 32768 tokens, but can only afford 3875. To increase, visit https://openrouter.ai/settings/credits and add more credits"},{"code":402,"message":"This request requires more credits, or fewer max_tokens. You requested up to 32768 tokens, but can only afford 3875. To increase, visit https://openrouter.ai/settings/credits and add more credits"},{"code":402,"message":"This request requires more credits, or fewer max_tokens. You requested up to 32768 tokens, but can only afford 3757. To increase, visit https://openrouter.ai/settings/credits and add more credits"},{"code":402,"message":"This request requires more credits, or fewer max_tokens. You requested up to 32768 tokens, but can only afford 2583. To increase, visit https://openrouter.ai/settings/credits and add more credits"},{"code":402,"message":"This request requires more credits, or fewer max_tokens. You requested up to 32768 tokens, but can only afford 5683. To increase, visit https://openrouter.ai/settings/credits and add more credits"},{"code":402,"message":"This request requires more credits, or fewer max_tokens. You requested up to 32768 tokens, but can only afford 5536. To increase, visit https://openrouter.ai/settings/cr... [truncated 2020 chars]
- NextAction: User reviews evidence and explicitly resumes with guidance

## 2026-07-08T14:48:52.889Z — Explicit Resume

- WorkItem: WI-AC-017
- Outcome: user authorized a new Attempt cycle
- Guidance: Root cause fixed: pi's model was requesting near-uncapped max_tokens against a zero-balance OpenRouter account, causing every call to 402. Switched to a free, explicitly-capped model (qwen/qwen3-coder:free, maxTokens:8192) and restarted. Fresh retry.
- NextAction: Coding Attempt 1

## 2026-07-08T14:49:40.954Z — Blocked Work Item

- Attempt: 1/3
- WorkItem: WI-AC-017
- Outcome: coding agent failed three times
- Defects: 429: {"message":"Rate limit exceeded: limit_rpm/qwen/qwen3-coder-480b-a35b-07-25/a9bbd882-011f-4606-8f60-85f3cb642586. High demand for qwen/qwen3-coder:free on OpenRouter - limited to 8 requests per minute. Please retry shortly.","code":429,"metadata":{"headers":{"X-RateLimit-Limit":"8","X-RateLimit-Remaining":"0","X-RateLimit-Reset":"1783522200000"},"provider_name":null}}
- NextAction: User reviews evidence and explicitly resumes with guidance

## 2026-07-08T16:43:34.938Z — Explicit Resume

- WorkItem: WI-AC-017
- Outcome: user authorized a new Attempt cycle
- Guidance: Confirmed via the log-detail fix: this block was pure OpenRouter 429 rate-limit exhaustion on qwen3-coder:free (8 req/min), not a real coding/QA defect -- the Work Item was never actually attempted. Also fixed the root cause (orchestrator now backs off before retrying after a 429 instead of instantly re-exhausting the same limit). Retry.
- NextAction: Coding Attempt 1

## 2026-07-08T16:43:36.453Z — Blocked Work Item

- Attempt: 1/3
- WorkItem: WI-AC-017
- Outcome: coding agent failed three times
- Defects: Error: Model "nvidia-nim/deepseek-ai/deepseek-v4-pro" not found. Use --list-models to see available models.
- NextAction: User reviews evidence and explicitly resumes with guidance
