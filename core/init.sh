#!/usr/bin/env bash
# init.sh — bring the CauseFlow core control plane to a verify-ready state.
# Idempotent: a healthy /health probe short-circuits the run. Honors $PORT.
# Does NOT start the docker-compose stack — integration / e2e / smoke paths
# need that separately (`docker-compose up -d` from the project root).

set -euo pipefail

PORT="${PORT:-3099}"
HEALTH_URL="http://127.0.0.1:${PORT}/health"
LOG_FILE="dev.log"

# Already up? Bail out clean — re-runs are no-ops.
if curl -sf -o /dev/null --max-time 2 "$HEALTH_URL" 2>/dev/null; then
  echo "Ready http://localhost:${PORT}  (already up)"
  exit 0
fi

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

# 3. start pnpm dev in the background, log to dev.log so agents can tail it.
export PORT
nohup pnpm dev >"$LOG_FILE" 2>&1 &

# 4. wait for /health to respond at all (200/4xx/5xx — degraded is still up).
for _ in $(seq 1 60); do
  code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 2 "$HEALTH_URL" 2>/dev/null || echo 000)
  [ "$code" != "000" ] && break
  sleep 1
done

echo "Ready http://localhost:${PORT}  (logs: $LOG_FILE)"
