# CauseFlow Docs — Architecture Invariants

Machine-verifiable contracts for the documentation site. Enforced by the `check-invariants.sh` PostToolUse hook. When an invariant is violated, the hook blocks the tool call until the fix is applied.

## Severity Vocabulary

- **Owner:** core incident module (`causeflow/core/docs/product/05-data-model.md`)
- **Preconditions:** any `.mdx` that mentions severity uses the authorized set
- **Postconditions:** enum exhaustively = `critical | high | medium | low | info`
- **Invariants:** no other severity tokens anywhere in `.mdx`
- **Verify:** `! grep -rEn 'severity[: ].*(emergency|urgent|notice|debug|warn)' /root/projects/causeflow/docs --include="*.mdx"`
- **Fix:** replace with `critical | high | medium | low | info`

## Status Vocabulary

- **Owner:** core incident state machine
- **Preconditions:** any page describing incident lifecycle lists the authorized transitions
- **Postconditions:** enum = `open → triaging → investigating → awaiting_approval → remediating → resolved → closed`
- **Invariants:** no other status tokens
- **Verify:** `! grep -rEn '"status": *"(dismissed|failed)"' /root/projects/causeflow/docs --include="*.mdx"`
- **Fix:** replace with the authorized status values
- **Note:** `"pending"` is valid for step-level and approval-level status. Only blocks `Incident.status = "pending"`, which is not in the authorized enum (Incident uses `"triaging"` and `"investigating"` for intermediate states). Do not add `pending` back to this grep.

## API Base URL

- **Owner:** production ingress (confirmed in Sprint 1 audit)
- **Preconditions:** every endpoint example uses exactly one host
- **Postconditions:** host is `https://api.causeflow.ai` (confirmed) — NOT `api.causeflow.io`
- **Invariants:** zero divergent hosts across all `.mdx`
- **Verify:** `! grep -rE 'api\.causeflow\.(io|dev|local|prod)' /root/projects/causeflow/docs --include="*.mdx"`
- **Fix:** replace with `api.causeflow.ai`

## No AWS Account / ARN / Internal Hostnames

- **Owner:** docs security boundary
- **Preconditions:** no MDX references AWS internal infrastructure identifiers
- **Postconditions:** no ARNs, no 12-digit account IDs next to "account", no `.internal` hostnames, no `sqs.<region>.amazonaws.com` URLs
- **Invariants:** zero hits
- **Verify:** `! grep -rE '(arn:aws:|\.internal[^a-z]|sqs\.[a-z0-9-]+\.amazonaws\.com|[0-9]{12}.*(account|arn))' /root/projects/causeflow/docs --include="*.mdx"`
- **Fix:** remove or replace with behavior-level description (e.g., "cross-account IAM role")

## No KMS / LangFuse / Hindsight / DynamoDB Internals

- **Owner:** docs security boundary
- **Preconditions:** no references to internal AWS service resource identifiers
- **Postconditions:** zero mentions of KMS key IDs, LangFuse URLs, Hindsight service URLs, internal DynamoDB table names, ECS cluster or task-definition names
- **Invariants:** grep returns empty
- **Verify:** `! grep -rEi '(kms:key/[a-f0-9-]{36}|langfuse|hindsight\.[a-z]+|causeflow-(staging|production)[- ]|/ecs/causeflow)' /root/projects/causeflow/docs --include="*.mdx"`
- **Fix:** replace with behavior-level description or remove

## Role Vocabulary

- **Owner:** core RBAC module — Sprint 1 audit to confirm authoritative set
- **Preconditions:** any RBAC content uses only the authoritative role set
- **Postconditions:** role enum is confirmed in `tasks/documentation/feature/2026-04-19_1400-public-docs-rewrite/audit.md`
- **Invariants:** no unapproved role names in `.mdx`
- **Verify:** Sprint 1 populates this with exact grep — until then, placeholder: `grep -rn 'roles?:' /root/projects/causeflow/docs --include="*.mdx" | review`
- **Fix:** align to audit output

## Event Vocabulary

- **Owner:** core EventBus module (`causeflow/core/docs/product/03-modules.md`)
- **Preconditions:** docs' outbound event names match core's EventBus registry exactly
- **Postconditions:** dot-namespaced events only (`incident.created`, `investigation.completed`, etc.)
- **Invariants:** every event mentioned in `api-reference/webhooks/outbound-events.mdx` appears in the EventBus registry
- **Verify:** manual cross-check during Sprint 4; Sprint 5 freezes list
- **Fix:** remove or add per core authority

## Every Page Has Frontmatter

- **Owner:** Mintlify build contract
- **Preconditions:** every `.mdx` has `title` and `description` fields in YAML frontmatter
- **Postconditions:** `description ≤ 160` chars
- **Invariants:** `mint dev` renders without MDX parse errors; broken-links returns 0
- **Verify:** `for f in $(find /root/projects/causeflow/docs -name '*.mdx' -not -path '*/node_modules/*' -not -path '*/.artifacts/*'); do head -5 "$f" | grep -q 'title:' || echo "MISSING TITLE: $f"; done`
- **Fix:** add frontmatter

## Tenant-ID, API-Key, JWT Placeholders

- **Owner:** docs content boundary
- **Preconditions:** examples use the approved placeholder formats
- **Postconditions:** only `ten_EXAMPLE_...`, `cflo_live_sk_EXAMPLE_...`, `eyJhbGc...` (truncated)
- **Invariants:** no real-looking UUIDs or full JWTs in any example
- **Verify:** `! grep -rE '(ten_[a-zA-Z0-9]{16,})|(cflo_live_sk_[a-zA-Z0-9]{16,})' /root/projects/causeflow/docs --include="*.mdx" | grep -v EXAMPLE`
- **Fix:** replace with approved placeholder
