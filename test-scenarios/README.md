# CauseFlow Test Scenarios

Curated incident simulations for testing CauseFlow's AI investigation pipeline. Each scenario provides realistic AWS evidence (DynamoDB records, CloudWatch logs) for a fictional company — **SimUser AI** — so the agent can be evaluated end-to-end without requiring real production incidents.

## Scenarios

| # | Title | Root Cause | Key Evidence |
|---|-------|-----------|--------------|
| 01 | [Stale pricing page after CMS update](./scenario-01-pricing-stale.md) | Tag-to-path mapping missing + TypeError in DynamoDB Streams handler | DynamoDB job with `retries: 3`, CloudWatch warn log on missing tag |
| 02 | [Broken images on `/from-momentic`](./scenario-02-imagens-quebradas.md) | Lambda cold start (3098ms) + 5s image fetch timeout → 504 | CloudWatch `INIT_START` + `TimeoutError`, self-healed after ~8min |
| 03 | [Intermittent 500 on `/get-started`](./scenario-03-get-started-500.md) | SSR failure returning 500 intermittently | DynamoDB failed revalidation job, CloudWatch WebsiteServer logs |

## Scenario Structure

Each scenario file contains:

- **Incident context** — company, date, reporter, Shortcut story
- **Problem description** — what the reporter observed
- **Available evidence** — DynamoDB records (exact expected JSON), CloudWatch log entries
- **Expected reasoning chain** — step-by-step path from symptom to root cause
- **Correct solution** — immediate fix + structural recommendations
- **Notion content** — runbook/architecture doc to paste post-resolution

## Running a Test

1. Feed the scenario's evidence sections to CauseFlow
2. Verify the agent's reasoning chain matches the expected chain
3. Verify the proposed solution matches the correct solution
4. Run cleanup after all scenarios are done

## Cleanup

After testing, run all items in [`cleanup-checklist.md`](./cleanup-checklist.md):
- Delete Shortcut stories #51–53
- Remove CloudWatch log streams (not the log groups)
- Remove test DynamoDB items
- Delete Notion pages
- Remove `/tmp/scenario0*.json` local files

The checklist uses `AWS_PROFILE=simuser` — export `$SHORTCUT_API_TOKEN` before running the curl commands.
