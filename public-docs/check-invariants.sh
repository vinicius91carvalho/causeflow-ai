#!/usr/bin/env bash
#
# check-invariants.sh - CauseFlow Docs content invariant enforcer.
#
# Enforces the machine-verifiable content contracts defined in INVARIANTS.md.
# Called by the PostToolUse hook in .claude/settings.json after every agent
# tool call so that invariants are never silently broken.
#
# Usage: bash check-invariants.sh [--quiet]
#   --quiet  suppress per-check output; only report summary / exit code
#
# Exit 0 if all invariants hold, 1 otherwise.

set -euo pipefail

QUIET=false
if [[ "${1:-}" == "--quiet" ]]; then
  QUIET=true
fi

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
failures=0

# Run a check. The argument is a shell command string that returns
# exit-0 when the invariant HOLDS and exit-nonzero when it VIOLATES.
run_check() {
  local label="$1"
  local cmd="$2"
  if $QUIET; then
    if eval "$cmd" >/dev/null 2>&1; then
      :  # pass
    else
      echo "[FAIL] $label"
      failures=$((failures + 1))
    fi
  else
    echo -n "  o $label ... "
    if eval "$cmd" >/dev/null 2>&1; then
      echo "PASS"
    else
      echo "FAIL"
      failures=$((failures + 1))
    fi
  fi
}

echo "=== CauseFlow Docs - Content Invariants ==="
echo ""

# 1. Severity vocabulary (AC-022)
run_check "Severity enum (no emergency|urgent|notice|debug|warn)" \
  '! grep -rEn "severity[: ].*(emergency|urgent|notice|debug|warn)" "$ROOT" --include="*.mdx"'

# 2. Incident status vocabulary (AC-023)
run_check 'Status enum (no "dismissed"|"failed")' \
  '! grep -rEn "\"status\": *\"(dismissed|failed)\"" "$ROOT" --include="*.mdx"'

# 3. API base URL (AC-016)
run_check 'API base URL (no api.causeflow.io|dev|local|prod)' \
  '! grep -rE "api\.causeflow\.(io|dev|local|prod)" "$ROOT" --include="*.mdx"'

# 4. No AWS identifiers / internal hostnames (AC-024)
run_check 'No AWS ARN / .internal / SQS URL / 12-digit account ID' \
  '! grep -rE "(arn:aws:|\.internal[^a-z]|sqs\.[a-z0-9-]+\.amazonaws\.com|[0-9]{12}.*(account|arn))" "$ROOT" --include="*.mdx"'

# 5. No KMS / LangFuse / Hindsight / ECS internals (part of AC-024)
run_check 'No KMS key / LangFuse / Hindsight / causeflow-staging|production / /ecs/causeflow' \
  '! grep -rEi "(kms:key/[a-f0-9-]{36}|langfuse|hindsight\.[a-z]+|causeflow-(staging|production)[- ]|/ecs/causeflow)" "$ROOT" --include="*.mdx"'

# 6. RBAC role vocabulary (AC-025)
run_check 'RBAC roles (no unapproved roles on role definition lines)' \
  '! grep -rn "roles?" "$ROOT" --include="*.mdx" | grep -vE "(admin|member|roles/viewer)" | grep -E "^\S+\.mdx.*(role|roles)"'

# 7. Tenant-ID, API-key, JWT placeholders (AC-017)
run_check 'Placeholder formats (no non-EXAMPLE ten_ or cflo_live_sk_ patterns)' \
  '! grep -rE "(ten_[a-zA-Z0-9]{16,})|(cflo_live_sk_[a-zA-Z0-9]{16,})" "$ROOT" --include="*.mdx" | grep -v EXAMPLE'

# 8. Frontmatter completeness (AC-004)
run_check 'Frontmatter title present on all .mdx' \
  '! for f in $(find "$ROOT" -name "*.mdx" -not -path "*/node_modules/*" -not -path "*/.mintlify/*" -not -path "*/drafts/*"); do head -5 "$f" | grep -q "title:" || echo "MISSING TITLE: $f"; done | grep .'

run_check 'Frontmatter description present on all .mdx' \
  '! for f in $(find "$ROOT" -name "*.mdx" -not -path "*/node_modules/*" -not -path "*/.mintlify/*" -not -path "*/drafts/*"); do head -5 "$f" | grep -q "description:" || echo "MISSING DESCRIPTION: $f"; done | grep .'

# 9. Description length (AC-005)
run_check 'Description length <= 160 chars' \
  'cd "$ROOT" && python3 "$ROOT/check-description-length.py" "$ROOT"'

echo ""
if [ "$failures" -eq 0 ]; then
  echo "All invariants hold."
  exit 0
else
  echo "$failures invariant(s) failed."
  exit 1
fi
