# integrations-and-notifications workflow journal

## 2026-07-08T15:39:20.881Z — Resumed

- WorkItem: WI-AC-030
- PreviousPhase: claimed
- Attempt: 1
- NextAction: start-orchestrator

## 2026-07-08T15:40:08.515Z — Blocked Work Item

- Attempt: 1/3
- WorkItem: WI-AC-030
- Outcome: coding agent failed three times
- Defects: 429: {"message":"Provider returned error","code":429,"metadata":{"raw":"qwen/qwen3-coder:free is temporarily rate-limited upstream. Please retry shortly, or add your own key to accumulate your rate limits: https://openrouter.ai/settings/integrations","provider_name":"Venice","is_byok":false,"retry_after_seconds":28,"retry_after_seconds_raw":27.85,"headers":{"Retry-After":"28"}}}
- NextAction: User reviews evidence and explicitly resumes with guidance

## 2026-07-08T16:34:18.468Z — Explicit Resume

- WorkItem: WI-AC-030
- Outcome: user authorized a new Attempt cycle
- Guidance: Confirmed via the log-detail fix: this block was pure OpenRouter 429 rate-limit exhaustion on qwen3-coder:free (8 req/min), not a real coding/QA defect -- the Work Item was never actually attempted. Also fixed the root cause (orchestrator now backs off before retrying after a 429 instead of instantly re-exhausting the same limit). Retry.
- NextAction: Coding Attempt 1

## 2026-07-08T16:34:20.235Z — Blocked Work Item

- Attempt: 1/3
- WorkItem: WI-AC-030
- Outcome: coding agent failed three times
- Defects: No API key found for openrouter.

Use /login to log into a provider via OAuth or API key. See:
  /home/vinicius/.local/share/mise/installs/node/24.16.0/lib/node_modules/@earendil-works/pi-coding-agent/docs/providers.md
  /home/vinicius/.local/share/mise/installs/node/24.16.0/lib/node_modules/@earendil-works/pi-coding-agent/docs/models.md
- NextAction: User reviews evidence and explicitly resumes with guidance

## 2026-07-08T16:43:28.712Z — Explicit Resume

- WorkItem: WI-AC-030
- Outcome: user authorized a new Attempt cycle
- Guidance: Confirmed pure OpenRouter 429 rate-limit exhaustion again, not a real defect. Root-caused the persistent contention: openrouter/qwen/qwen3-coder:free's 8 req/min limit is shared across the whole account and further saturated by external OpenRouter demand -- even with backoff+jitter, 4 concurrent subprojects kept exhausting it. Switched the pi adapter to NVIDIA NIM's deepseek-v4-pro (separate unshared quota pool, 40 req/min, verified reachable). Retry.
- NextAction: Coding Attempt 1

## 2026-07-08T16:43:30.198Z — Blocked Work Item

- Attempt: 1/3
- WorkItem: WI-AC-030
- Outcome: coding agent failed three times
- Defects: Error: Model "nvidia-nim/deepseek-ai/deepseek-v4-pro" not found. Use --list-models to see available models.
- NextAction: User reviews evidence and explicitly resumes with guidance

## 2026-07-08T21:08:11.301Z — Explicit Resume

- WorkItem: WI-AC-030
- Outcome: user authorized a new Attempt cycle
- Guidance: This block was a real bug in my own config, not a code defect: the previous pi adapter switch referenced a made-up provider key (nvidia-nim) in models.json that pi never actually recognized -- it needed either an explicit 'api' field (unrecognized custom provider) or credentials in ~/.pi/agent/auth.json under pi's real native provider key, neither of which was done. Fixed: credentials now in auth.json under the correct native keys (nvidia, opencode-go), and the adapter points at opencode-go/deepseek-v4-flash (much higher throughput ceiling, verified working end-to-end via a direct pi invocation before this retry). Retry.
- NextAction: Coding Attempt 1

## 2026-07-08T21:21:00.000Z — Verified AC-030

- WorkItem: WI-AC-030
- Implementation: true
- Changes:
  - Added POST /install endpoint to slack.routes.ts (initiates Slack OAuth, returns auth URL)
  - Added POST /events endpoint with Slack signing secret verification (401 on tampered body)
  - Added SLACK_SIGNING_SECRET to config and SlackOAuthConfig type
  - Added /v1/auth/oss-login and /v1/integrations/slack/events to PUBLIC_PATHS
  - Added local JWT verification (fallback when Clerk is not configured)
  - Added /v1/integrations/slack/events to tenant middleware skip list
  - Always mount Slack routes (removed conditional on SLACK_CLIENT_ID)
  - Added SLACK_SIGNING_SECRET env var to docker-compose.yml with dev default
- Verification results:
  - POST /install with auth returns auth URL (200) ✅
  - POST /install without auth returns 401 ✅
  - POST /events url_verification returns challenge token (200) ✅
  - POST /events with valid signature returns 200 ✅
  - POST /events with tampered body returns 401 ✅
  - POST /events with stale timestamp returns 401 ✅

## 2026-07-08T21:34:00.000Z — Re-verified AC-030 (boundary tests passed)

- WorkItem: WI-AC-030
- Implementation: true
- Re-verification results (all pass):
  - POST /install without auth returns 401 ✅
  - POST /install with valid auth returns 200 + authUrl ✅
  - POST /events url_verification returns challenge (200) ✅
  - POST /events with valid signature returns 200 ✅
  - POST /events with tampered body returns 401 ✅
  - POST /events with stale timestamp returns 401 ✅
- Changes: none (zero-diff re-verification, working tree clean)

## 2026-07-08T22:00:00.000Z — Verified AC-030 (TS fix + re-verify)

- WorkItem: WI-AC-030
- Implementation: true
- Boundary tests (all pass against live API at :3099):
  - POST /install (authed) returns 200 + authUrl + state ✅
  - POST /events url_verification returns challenge (200) ✅
  - POST /events valid signature returns 200 ✅
  - POST /events tampered body returns 401 ✅
  - POST /events missing signature headers returns 401 ✅
  - POST /events stale timestamp returns 401 ✅
  - GET /oauth/callback missing params returns 400 ✅
  - GET /oauth/callback tampered state returns 400 ✅
- Change: added missing `signingSecret` to test mock to fix TS compilation
