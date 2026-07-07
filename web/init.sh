#!/usr/bin/env bash
# init.sh — bring the CauseFlow web monorepo (website + dashboard) to a
# verify-ready state. Idempotent: a healthy probe on either port short-circuits
# the run. Honors $PORT (default 3000, the website port); the dashboard runs
# on $((PORT+1)). The dashboard dev script pins -p 3001, so PORT=3000 is the
# only mode where both apps land on the documented ports.
#
# Does NOT start external services (Core API, Clerk, Stripe, Sentry). Those
# are out of scope for the harness bring-up — set CORE_API_URL in
# apps/dashboard/.env.local for the mock-client fallback to kick in.

set -euo pipefail

PORT="${PORT:-3000}"
WEBSITE_PORT="${PORT}"
DASHBOARD_PORT="${PORT:-3000}"
DASHBOARD_PORT="$((DASHBOARD_PORT + 1))"
WEBSITE_URL="http://127.0.0.1:${WEBSITE_PORT}"
DASHBOARD_URL="http://localhost:${DASHBOARD_PORT}"
LOG_FILE="dev.log"

# Already up? Bail out clean — re-runs are no-ops.
if curl -sf -o /dev/null --max-time 2 "${WEBSITE_URL}/" 2>/dev/null \
   && curl -sf -o /dev/null --max-time 2 "${DASHBOARD_URL}/" 2>/dev/null; then
  echo "Ready ${WEBSITE_URL}  ${DASHBOARD_URL}  (already up)"
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

# 3. start pnpm turbo dev in the background, log to dev.log so agents can tail it.
#    The website reads $PORT; the dashboard's dev script pins -p 3001 so when
#    $PORT=3000 the dashboard lands on 3001 as documented.
export PORT
nohup pnpm turbo dev >"$LOG_FILE" 2>&1 &

# 4. wait for both ports to respond at all (200/4xx/5xx — degraded is still up).
for _ in $(seq 1 90); do
  site=$(curl -s -o /dev/null -w '%{http_code}' --max-time 2 "${WEBSITE_URL}/" 2>/dev/null || echo 000)
  dash=$(curl -s -o /dev/null -w '%{http_code}' --max-time 2 "${DASHBOARD_URL}/" 2>/dev/null || echo 000)
  [ "$site" != "000" ] && [ "$dash" != "000" ] && break
  sleep 1
done

echo "Ready ${WEBSITE_URL}  ${DASHBOARD_URL}  (logs: $LOG_FILE)"
