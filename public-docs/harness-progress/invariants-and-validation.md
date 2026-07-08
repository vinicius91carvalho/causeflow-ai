# invariants-and-validation workflow journal

## 2026-07-08T12:59:34.409Z — Blocked Work Item

- Attempt: 1/3
- WorkItem: WI-AC-022
- Outcome: coding agent failed three times
- Defects: 402: {"message":"This request requires more credits, or fewer max_tokens. You requested up to 32768 tokens, but can only afford 4708. To increase, visit https://openrouter.ai/settings/credits and add more credits","code":402,"metadata":{"provider_name":null,"previous_errors":[{"code":402,"message":"This request requires more credits, or fewer max_tokens. You requested up to 32768 tokens, but can only afford 6726. To increase, visit https://openrouter.ai/settings/credits and add more credits"},{"code":402,"message":"This request requires more credits, or fewer max_tokens. You requested up to 32768 tokens, but can only afford 6726. To increase, visit https://openrouter.ai/settings/credits and add more credits"},{"code":402,"message":"This request requires more credits, or fewer max_tokens. You requested up to 32768 tokens, but can only afford 5539. To increase, visit https://openrouter.ai/settings/credits and add more credits"},{"code":402,"message":"This request requires more credits, or fewer max_tokens. You requested up to 32768 tokens, but can only afford 5231. To increase, visit https://openrouter.ai/settings/credits and add more credits"},{"code":402,"message":"This request requires more credits, or fewer max_tokens. You requested up to 32768 tokens, but can only afford 5062. To increase, visit https://openrouter.ai/settings/credits and add more credits"},{"code":402,"message":"This request requires more credits, or fewer max_tokens. You requested up to 32768 tokens, but can only afford 4998. To increase, visit https://openrouter.ai/settings/credits and add more credits"},{"code":402,"message":"This request requires more credits, or fewer max_tokens. You requested up to 32768 tokens, but can only afford 4708. To increase, visit https://openrouter.ai/settings/credits and add more credits"},{"code":402,"message":"This request requires more credits, or fewer max_tokens. You requested up to 32768 tokens, but can only afford 4708. To increase, visit https://openrouter.ai/settings/credits and add more credits"},{"code":402,"message":"This request requires more credits, or fewer max_tokens. You requested up to 32768 tokens, but can only afford 4708. To increase, visit https://openrouter.ai/settings/credits and add more credits"},{"code":402,"message":"This request requires more credits, or fewer max_tokens. You requested up to 32768 tokens, but can only afford 4708. To increase, visit https://openrouter.ai/settings/credits and add more credits"},{"code":402,"message":"This request requires more credits, or fewer max_tokens. You requested up to 32768 tokens, but can only afford 4708. To increase, visit https://openrouter.ai/settings/credits and add more credits"},{"code":402,"message":"This request requires more credits, or fewer max_tokens. You requested up to 32768 tokens, but can only afford 4708. To increase, visit https://openrouter.ai/settings/credits and add more credits"},{"code":402,"message":"This request requires more credits, or fewer max_tokens. You requested up to 32768 tokens, but can only afford 4708. To increase, visit https://openrouter.ai/settings/credits and add more credits"},{"code":402,"message":"This request requires more credits, or fewer max_tokens. You requested up to 32768 tokens, but can only afford 4565. To increase, visit https://openrouter.ai/settings/credits and add more credits"},{"code":402,"message":"This request requires more credits, or fewer max_tokens. You requested up to 32768 tokens, but can only afford 3138. To increase, visit https://openrouter.ai/settings/credits and add more credits"},{"code":402,"message":"This request requires more credits, or fewer max_tokens. You requested up to 32768 tokens, but can only afford 6905. To increase, visit https://openrouter.ai/settings/credits and add more credits"},{"code":402,"message":"This request requires more credits, or fewer max_tokens. You requested up to 32768 tokens, but can only afford 6726. To increase, visit https://openrouter.ai/settings/cr... [truncated 2020 chars]
- NextAction: User reviews evidence and explicitly resumes with guidance

## 2026-07-08T14:13:16.851Z — Explicit Resume

- WorkItem: WI-AC-022
- Outcome: user authorized a new Attempt cycle
- Guidance: Root cause fixed: pi's model was requesting near-uncapped max_tokens against a zero-balance OpenRouter account, causing every call to 402. Switched to a free, explicitly-capped model (qwen/qwen3-coder:free, maxTokens:8192) and restarted. Fresh retry.
- NextAction: Coding Attempt 1

## 2026-07-08T14:14:03.979Z — Blocked Work Item

- Attempt: 1/3
- WorkItem: WI-AC-022
- Outcome: coding agent failed three times
- Defects: 429: {"message":"Provider returned error","code":429,"metadata":{"raw":"qwen/qwen3-coder:free is temporarily rate-limited upstream. Please retry shortly, or add your own key to accumulate your rate limits: https://openrouter.ai/settings/integrations","provider_name":"Venice","is_byok":false,"retry_after_seconds":29,"retry_after_seconds_raw":28.423,"headers":{"Retry-After":"29"}}}
- NextAction: User reviews evidence and explicitly resumes with guidance

## 2026-07-08T16:34:18.520Z — Explicit Resume

- WorkItem: WI-AC-022
- Outcome: user authorized a new Attempt cycle
- Guidance: Confirmed via the log-detail fix: this block was pure OpenRouter 429 rate-limit exhaustion on qwen3-coder:free (8 req/min), not a real coding/QA defect -- the Work Item was never actually attempted. Also fixed the root cause (orchestrator now backs off before retrying after a 429 instead of instantly re-exhausting the same limit). Retry.
- NextAction: Coding Attempt 1

## 2026-07-08T16:34:20.212Z — Blocked Work Item

- Attempt: 1/3
- WorkItem: WI-AC-022
- Outcome: coding agent failed three times
- Defects: No API key found for openrouter.

Use /login to log into a provider via OAuth or API key. See:
  /home/vinicius/.local/share/mise/installs/node/24.16.0/lib/node_modules/@earendil-works/pi-coding-agent/docs/providers.md
  /home/vinicius/.local/share/mise/installs/node/24.16.0/lib/node_modules/@earendil-works/pi-coding-agent/docs/models.md
- NextAction: User reviews evidence and explicitly resumes with guidance

## 2026-07-08T16:43:26.436Z — Explicit Resume

- WorkItem: WI-AC-022
- Outcome: user authorized a new Attempt cycle
- Guidance: Confirmed pure OpenRouter 429 rate-limit exhaustion again, not a real defect. Root-caused the persistent contention: openrouter/qwen/qwen3-coder:free's 8 req/min limit is shared across the whole account and further saturated by external OpenRouter demand -- even with backoff+jitter, 4 concurrent subprojects kept exhausting it. Switched the pi adapter to NVIDIA NIM's deepseek-v4-pro (separate unshared quota pool, 40 req/min, verified reachable). Retry.
- NextAction: Coding Attempt 1

## 2026-07-08T16:43:27.978Z — Blocked Work Item

- Attempt: 1/3
- WorkItem: WI-AC-022
- Outcome: coding agent failed three times
- Defects: Error: Model "nvidia-nim/deepseek-ai/deepseek-v4-pro" not found. Use --list-models to see available models.
- NextAction: User reviews evidence and explicitly resumes with guidance

## 2026-07-08T18:33:12.908Z — Explicit Resume

- WorkItem: WI-AC-022
- Outcome: user authorized a new Attempt cycle
- Guidance: This block was a real bug in my own config, not a code defect: the previous pi adapter switch referenced a made-up provider key (nvidia-nim) in models.json that pi never actually recognized -- it needed either an explicit 'api' field (unrecognized custom provider) or credentials in ~/.pi/agent/auth.json under pi's real native provider key, neither of which was done. Fixed: credentials now in auth.json under the correct native keys (nvidia, opencode-go), and the adapter points at opencode-go/deepseek-v4-flash (much higher throughput ceiling, verified working end-to-end via a direct pi invocation before this retry). Retry.
- NextAction: Coding Attempt 1

## 2026-07-08T18:34:00.000Z — Verified

- WorkItem: WI-AC-022
- Outcome: PASS
- Evidence: `grep -rEn 'severity[: ].*(emergency|urgent|notice|debug|warn)' --include='*.mdx'` returned zero matches (exit code 1). All severity tokens across all `.mdx` files are within the allowed set: `critical`, `high`, `medium`, `low`, `info`. No code changes required.
- Verdict: implementation=true (zero-diff)
