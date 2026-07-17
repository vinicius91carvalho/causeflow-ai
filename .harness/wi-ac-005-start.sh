#!/usr/bin/env bash
# Start @causeflow/website on harness PORT (default 5171) for AC-005 HTTP probes.
set -euo pipefail
export PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:${HOME}/.local/bin:${PATH}"
if [ -x "${HOME}/.local/share/mise/installs/node/24.16.0/bin/node" ]; then
  export PATH="${HOME}/.local/share/mise/installs/node/24.16.0/bin:${PATH}"
fi
WORKDIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PORT="${PORT:-5171}"
LOG="${WORKDIR}/.harness/wi-ac-005-website.log"
mkdir -p "${WORKDIR}/.harness"
: > "${LOG}"
cd "${WORKDIR}/web"
export PORT
if curl -sf -o /dev/null --max-time 2 "http://127.0.0.1:${PORT}/" 2>/dev/null; then
  echo "Ready already up"
  exit 0
fi
if [ ! -d node_modules ]; then
  corepack enable >/dev/null 2>&1 || true
  pnpm install --frozen-lockfile
fi
setsid pnpm --filter @causeflow/website exec next dev --hostname 127.0.0.1 -p "${PORT}" >>"${LOG}" 2>&1 < /dev/null &
echo $! > "${WORKDIR}/.harness/app.pid"
echo "started pid=$(cat "${WORKDIR}/.harness/app.pid")"
printf '{"at":"%s","kind":"wi-ac-005-website","port":%s,"pids":[%s],"log":"%s"}\n' \
  "$(date -Iseconds)" "${PORT}" "$(cat "${WORKDIR}/.harness/app.pid")" "${LOG}" \
  >> "${WORKDIR}/.harness/runtime-owned.jsonl"
ready=0
for i in $(seq 1 60); do
  code=$(curl -sS -o /dev/null -w '%{http_code}' --max-time 3 "http://127.0.0.1:${PORT}/" 2>/dev/null || true)
  if [ -z "${code}" ]; then code=000; fi
  echo "try=${i} code=${code}"
  case "${code}" in
    200|301|302|304) ready=1; break ;;
  esac
  sleep 1
done
if [ "${ready}" != "1" ]; then
  echo "TIMEOUT waiting for Ready on :${PORT}"
  echo "=== last 100 log lines ==="
  tail -n 100 "${LOG}" || true
  exit 1
fi
echo "Ready http://127.0.0.1:${PORT}/"
