#!/usr/bin/env bash
# init.sh — bring the CauseFlow core control plane to a verify-ready state.
# Idempotent: a healthy /health probe short-circuits the API start. Honors $PORT.
# Does NOT start the docker-compose stack — integration / e2e / smoke paths
# need that separately (`docker compose up -d` from the project root).
#
# AC-046: also starts the OSS investigation BullMQ worker on the host. Without
# it, triage completes (severity set) but incidents stay in `triaging` forever.

set -euo pipefail

PORT="${PORT:-3099}"
HEALTH_URL="http://127.0.0.1:${PORT}/health"
LOG_FILE="dev.log"
WORKER_LOG_FILE="worker.log"
HARNESS_DIR=".harness"
APP_PID_FILE="${HARNESS_DIR}/app.pid"
WORKER_PID_FILE="${HARNESS_DIR}/worker.pid"

mkdir -p "$HARNESS_DIR"

worker_alive() {
  if [ -f "$WORKER_PID_FILE" ]; then
    local pid
    pid="$(cat "$WORKER_PID_FILE" 2>/dev/null || true)"
    if [ -n "${pid:-}" ] && kill -0 "$pid" 2>/dev/null; then
      return 0
    fi
  fi
  # Fallback: any host-dev investigation worker process
  pgrep -f 'src/workers/investigation-worker.ts' >/dev/null 2>&1
}

start_worker() {
  if worker_alive; then
    echo "Investigation worker already running"
    return 0
  fi
  export PORT
  export CAUSEFLOW_RUNTIME="${CAUSEFLOW_RUNTIME:-oss}"
  # Host-dev worker shares .env.dev (Postgres/Redis on published ports).
  nohup pnpm exec tsx --env-file=.env.dev src/workers/investigation-worker.ts \
    >"$WORKER_LOG_FILE" 2>&1 &
  echo $! >"$WORKER_PID_FILE"
  echo "Started investigation worker pid=$(cat "$WORKER_PID_FILE") (logs: $WORKER_LOG_FILE)"
}

# 1. jq — the generator's claim.sh helper needs it.
if ! command -v jq >/dev/null 2>&1; then
  apt-get install -y jq >/dev/null 2>&1 \
    || dnf install -y jq >/dev/null 2>&1 \
    || true
fi

# 2. pnpm deps — install once (lockfile is the source of truth).
if [ ! -d node_modules ]; then
  corepack enable >/dev/null 2>&1 || true
  if [ -f pnpm-lock.yaml ]; then
    pnpm install --frozen-lockfile
  else
    pnpm install
  fi
fi

# 3. start API if not already healthy.
health_code() {
  # Avoid `curl ... || echo 000` — a failed curl with -w still prints 000,
  # and the fallback would concatenate to "000000".
  curl -s -o /dev/null -w '%{http_code}' --max-time 2 "$HEALTH_URL" 2>/dev/null || true
}

EXISTING_CODE="$(health_code)"
if [ "$EXISTING_CODE" = "200" ] || [ "$EXISTING_CODE" = "503" ]; then
  echo "API already up at http://localhost:${PORT}"
else
  export PORT
  nohup pnpm dev >"$LOG_FILE" 2>&1 &
  echo $! >"$APP_PID_FILE"

  for _ in $(seq 1 60); do
    code="$(health_code)"
    if [ "$code" = "200" ] || [ "$code" = "503" ]; then
      break
    fi
    sleep 1
  done
fi

# 4. Always ensure the investigation worker is up (AC-045 / AC-046).
start_worker

echo "Ready http://localhost:${PORT}  (logs: $LOG_FILE, worker: $WORKER_LOG_FILE)"
