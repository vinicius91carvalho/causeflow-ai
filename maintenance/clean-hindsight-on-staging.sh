#!/usr/bin/env bash
#
# Run scripts/clean-hindsight-memories.mjs against the **staging** Hindsight service
# by executing inside the staging API container via ECS Exec.
#
# The Hindsight service lives on the private VPC (Cloud Map: hindsight.causeflow-staging.local:8888)
# so it's not reachable from a developer machine. This wrapper:
#   1. Auto-installs `session-manager-plugin` if missing (Ubuntu/Debian only)
#   2. Discovers a RUNNING task on the staging API service
#   3. Verifies ECS Exec is enabled on it
#   4. Encodes the local .mjs payload, ships it via `aws ecs execute-command`,
#      runs it from /app (so node_modules resolves), and cleans up the temp file
#
# Usage:
#   scripts/clean-hindsight-on-staging.sh <tenantId>            # LIST ONLY (default — safe)
#   scripts/clean-hindsight-on-staging.sh <tenantId> --clear    # run with --clear (no-ops if no pollution)
#   scripts/clean-hindsight-on-staging.sh <tenantId> --force    # nuke bank entirely (deleteBank — destructive)
#
# Env overrides (rarely needed):
#   AWS_REGION       default us-east-2
#   ECS_CLUSTER      default causeflow-staging
#   ECS_SERVICE      default causeflow-staging
#   ECS_CONTAINER    default causeflow
#
# Production: set ECS_CLUSTER=causeflow-production and ECS_SERVICE=causeflow-production.
# Be VERY careful — production EFS retains data and clear is genuinely destructive.

set -euo pipefail

REGION="${AWS_REGION:-us-east-2}"
CLUSTER="${ECS_CLUSTER:-causeflow-staging}"
SERVICE="${ECS_SERVICE:-causeflow-staging}"
CONTAINER="${ECS_CONTAINER:-causeflow}"

TENANT="${1:-}"
FLAG="${2:-}"

if [[ -z "$TENANT" ]]; then
  cat >&2 <<USAGE
Usage: $0 <tenantId> [--clear|--force]

Modes:
  (no flag)  LIST ONLY — show memories, mark which match the cost/token regex
  --clear    Run clean-hindsight-memories.mjs with --clear (script no-ops unless pollution detected)
  --force    Force deleteBank (wipes ALL memories regardless of pollution; bank auto-recreates on next use)

Example:
  $0 org_3CIe2PY6G6xwnUu9TA0oopGUW9u
  $0 org_3CIe2PY6G6xwnUu9TA0oopGUW9u --force
USAGE
  exit 1
fi

case "$FLAG" in
  ""|--list)   MODE="list" ;;
  --clear)     MODE="clear" ;;
  --force)     MODE="force" ;;
  *) echo "Unknown flag: $FLAG (use --clear or --force)" >&2; exit 1 ;;
esac

# --- Dependency check: aws cli ---
command -v aws >/dev/null 2>&1 || { echo "aws cli not installed" >&2; exit 1; }

# --- Dependency check: session-manager-plugin (auto-install on Ubuntu/Debian) ---
if ! command -v session-manager-plugin >/dev/null 2>&1; then
  echo "session-manager-plugin missing — attempting auto-install..."
  arch=$(uname -m)
  case "$arch" in
    aarch64|arm64) PKG_ARCH="ubuntu_arm64" ;;
    x86_64)        PKG_ARCH="ubuntu_64bit" ;;
    *) echo "Unsupported arch '$arch' for auto-install. Install manually: https://docs.aws.amazon.com/systems-manager/latest/userguide/session-manager-working-with-install-plugin.html" >&2; exit 1 ;;
  esac
  if ! command -v dpkg >/dev/null 2>&1; then
    echo "dpkg not found — auto-install only works on Debian/Ubuntu. Install plugin manually." >&2
    exit 1
  fi
  curl -fsSL "https://s3.amazonaws.com/session-manager-downloads/plugin/latest/${PKG_ARCH}/session-manager-plugin.deb" -o /tmp/ssm-plugin.deb
  if [[ "$EUID" -eq 0 ]]; then dpkg -i /tmp/ssm-plugin.deb; else sudo dpkg -i /tmp/ssm-plugin.deb; fi
  rm -f /tmp/ssm-plugin.deb
fi

# --- AWS auth sanity check ---
if ! aws sts get-caller-identity --output text >/dev/null 2>&1; then
  echo "aws sts get-caller-identity failed — re-authenticate (aws sso login or refresh credentials)" >&2
  exit 1
fi

# --- Discover running task ---
echo "Looking up RUNNING task on $CLUSTER/$SERVICE in $REGION..."
TASK_ARN=$(aws ecs list-tasks --region "$REGION" \
  --cluster "$CLUSTER" --service-name "$SERVICE" \
  --desired-status RUNNING \
  --query 'taskArns[0]' --output text)
if [[ -z "$TASK_ARN" || "$TASK_ARN" == "None" ]]; then
  echo "No RUNNING tasks found on $CLUSTER/$SERVICE" >&2
  exit 1
fi
TASK_ID=${TASK_ARN##*/}
echo "Task: $TASK_ID"

# --- Verify ECS Exec enabled ---
EXEC_OK=$(aws ecs describe-tasks --region "$REGION" \
  --cluster "$CLUSTER" --tasks "$TASK_ID" \
  --query 'tasks[0].enableExecuteCommand' --output text)
if [[ "$EXEC_OK" != "True" ]]; then
  echo "ECS Exec is not enabled on this task. Re-deploy the service with --enable-execute-command." >&2
  exit 1
fi

BANK_ID="causeflow-${TENANT}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# --- Build the payload .mjs (encoded as base64 for safe transport via --command) ---
case "$MODE" in
  list|clear)
    LOCAL_SCRIPT="$SCRIPT_DIR/clean-hindsight-memories.mjs"
    [[ -f "$LOCAL_SCRIPT" ]] || { echo "Missing $LOCAL_SCRIPT" >&2; exit 1; }
    PAYLOAD_B64=$(base64 -w0 "$LOCAL_SCRIPT")
    EXTRA_ARGS=""
    [[ "$MODE" == "clear" ]] && EXTRA_ARGS=" --clear"
    REMOTE_CMD="cd /app && echo $PAYLOAD_B64 | base64 -d > _hindsight.mjs && node _hindsight.mjs $TENANT$EXTRA_ARGS; rc=\$?; rm -f _hindsight.mjs; exit \$rc"
    ;;
  force)
    INLINE_JS=$(cat <<EOF
import { HindsightClient } from "@vectorize-io/hindsight-client";
const c = new HindsightClient({ baseUrl: process.env.HINDSIGHT_BASE_URL, apiKey: process.env.HINDSIGHT_API_KEY });
const bankId = "$BANK_ID";
console.log("Force mode | Bank:", bankId);
const before = await c.listMemories(bankId, { limit: 1000 }).catch(() => ({ items: [] }));
console.log("Before:", (before.items ?? []).length, "memories");
await c.deleteBank(bankId);
const after = await c.listMemories(bankId, { limit: 5 }).catch(e => ({ items: [], err: e.message }));
console.log("After:", (after.items ?? []).length, "memories");
console.log("Bank deleted. Auto-recreates on next investigation.");
EOF
)
    PAYLOAD_B64=$(echo "$INLINE_JS" | base64 -w0)
    REMOTE_CMD="cd /app && echo $PAYLOAD_B64 | base64 -d > _hindsight.mjs && node _hindsight.mjs; rc=\$?; rm -f _hindsight.mjs; exit \$rc"
    ;;
esac

echo "Mode: $MODE | Bank: $BANK_ID"
echo "---"
aws ecs execute-command --region "$REGION" \
  --cluster "$CLUSTER" --task "$TASK_ID" \
  --container "$CONTAINER" --interactive \
  --command "sh -c '$REMOTE_CMD'"
