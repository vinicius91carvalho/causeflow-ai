#!/usr/bin/env bash
# init.sh — start the CauseFlow Relay for the harness.
#
# The relay is an outbound WebSocket client, not a listening server, so
# PORT / FRONTEND_PORT / BACKEND_PORT are accepted from the environment
# (default 5175) but do not affect the runtime. We use them purely so
# concurrent worktrees can co-exist on different ports and so the harness
# orchestrator's `Ready <urls>` line stays consistent with sibling projects.
#
# Boot path:
#   1. Make sure `jq` is on PATH (the generator's claim helper needs it).
#   2. Make sure `node_modules/` is populated.
#   3. Launch the relay under `npm run dev` in the background, log → dev.log.
#   4. Wait for the pino "Config loaded" line (i.e. config parsed + drivers
#      initialized) and print `Ready` with the WebSocket URL it is dialing.

set -euo pipefail

cd "$(dirname "$0")"

# Help flag — does not start the service.
if [ "${1:-}" = "-h" ] || [ "${1:-}" = "--help" ]; then
  cat <<USAGE
init.sh — start the CauseFlow Relay for the harness smoke test.

Usage: init.sh
       init.sh --help

Environment:
  PORT / FRONTEND_PORT / BACKEND_PORT  (default 5175) — informational only;
        the relay is an outbound WebSocket client and does not listen on a port.
  RELAY_TOKEN, TENANT_ID, CONTROL_PLANE_URL — env-var fallback config
        (the loader uses these when no relay-config.yaml is present).
  MASKING_ENABLED, AUDIT_ENABLED  (default true) — feature toggles.

Behavior:
  Installs node_modules if missing, starts \`npm run dev\` in the background
  (logs to dev.log, pid in dev.pid), waits up to 30s for the
  "Config loaded" pino line, then prints \`Ready ...\`.
USAGE
  exit 0
fi

PORT="${PORT:-5175}"
FRONTEND_PORT="${FRONTEND_PORT:-$PORT}"
BACKEND_PORT="${BACKEND_PORT:-$PORT}"

LOG_FILE="dev.log"
PID_FILE="dev.pid"

# --- deps -----------------------------------------------------------------
if ! command -v jq >/dev/null 2>&1; then
  echo "init.sh: installing jq (required by the harness claim helper)"
  if command -v apt-get >/dev/null 2>&1; then
    sudo apt-get update -y >/dev/null && sudo apt-get install -y jq >/dev/null
  elif command -v apk >/dev/null 2>&1; then
    sudo apk add --no-cache jq >/dev/null
  fi
fi

if [ ! -d node_modules ]; then
  echo "init.sh: installing node_modules"
  npm install --no-audit --no-fund
fi

# --- env ------------------------------------------------------------------
# Use the documented env-var fallback path (no YAML file) so the relay
# boots without any customer config. Control plane URL is intentionally
# a non-routable address — the relay will retry-connect, which is the
# expected behavior at the harness smoke-test boundary.
export RELAY_TOKEN="${RELAY_TOKEN:-harness-smoke-token}"
export TENANT_ID="${TENANT_ID:-harness-tenant}"
export CONTROL_PLANE_URL="${CONTROL_PLANE_URL:-ws://127.0.0.1:9/v1/relay/connect}"
# Default masking + audit on, matching project_specs.xml.
export MASKING_ENABLED="${MASKING_ENABLED:-true}"
export AUDIT_ENABLED="${AUDIT_ENABLED:-true}"

# --- launch ---------------------------------------------------------------
# If a previous run left a PID file, reap it so the port + log stay clean.
if [ -f "$PID_FILE" ]; then
  OLD_PID="$(cat "$PID_FILE" 2>/dev/null || true)"
  if [ -n "${OLD_PID:-}" ] && kill -0 "$OLD_PID" 2>/dev/null; then
    kill "$OLD_PID" 2>/dev/null || true
    sleep 0.5
  fi
  rm -f "$PID_FILE"
fi

: > "$LOG_FILE"

# `npm run dev` runs `tsx watch src/index.ts`. We start it in the background
# so the harness can probe readiness by tailing dev.log.
nohup npm run dev >>"$LOG_FILE" 2>&1 &
RELAY_PID=$!
echo "$RELAY_PID" > "$PID_FILE"

# --- wait for boot --------------------------------------------------------
# The relay logs `Config loaded` once Zod validation has passed and the
# per-resource drivers have been (or failed to be) constructed. That is
# the earliest reliable "service is up" signal — well before the WS
# handshake, which may never complete in a harness sandbox.
DEADLINE=$((SECONDS + 30))
while [ $SECONDS -lt $DEADLINE ]; do
  if ! kill -0 "$RELAY_PID" 2>/dev/null; then
    echo "init.sh: relay process exited before becoming ready. Last log lines:"
    tail -n 40 "$LOG_FILE" || true
    exit 1
  fi
  if grep -q "Config loaded" "$LOG_FILE" 2>/dev/null; then
    break
  fi
  sleep 0.5
done

if ! grep -q "Config loaded" "$LOG_FILE" 2>/dev/null; then
  echo "init.sh: timed out waiting for 'Config loaded' in $LOG_FILE. Last log lines:"
  tail -n 40 "$LOG_FILE" || true
  exit 1
fi

# --- announce -------------------------------------------------------------
# The relay has no listening port — its only network surface is the
# outbound WebSocket to the control plane. The harness convention is to
# print `Ready <urls>`; we surface both the WebSocket it is dialing and
# the (informational) PORT the harness asked us to bind to.
echo "Ready frontend=http://127.0.0.1:${FRONTEND_PORT} backend=http://127.0.0.1:${BACKEND_PORT} controlPlane=${CONTROL_PLANE_URL} log=${LOG_FILE} pid=${RELAY_PID}"
