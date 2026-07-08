#!/usr/bin/env sh
# init.sh — Mintlify dev server + broken-link check harness.
#
# Boots `mint dev` on $PORT (default 3000) for this Mintlify docs site, waits
# until the homepage responds with HTTP 200, then runs `mint broken-links`
# and propagates its exit code. Cleans up the background mint process on
# exit. Idempotent: any prior mint bound to $PORT is killed first.
#
# Does NOT install the `mint` CLI; that is a prerequisite per project_specs.xml.

set -eu

# Resolve project root from this script's location so the script is safe to
# invoke from any cwd.
SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd)
cd "$SCRIPT_DIR"

: "${PORT:=3000}"
export PORT

LOG_FILE="$SCRIPT_DIR/dev.log"
PID_FILE="$SCRIPT_DIR/.mint.pid"

cleanup() {
  if [ -f "$PID_FILE" ]; then
    pid=$(cat "$PID_FILE" 2>/dev/null || true)
    if [ -n "${pid:-}" ] && kill -0 "$pid" 2>/dev/null; then
      kill "$pid" 2>/dev/null || true
      sleep 1
      kill -9 "$pid" 2>/dev/null || true
    fi
    rm -f "$PID_FILE"
  fi
}
trap cleanup EXIT INT TERM

# Kill any stale mint left by a prior run.
if [ -f "$PID_FILE" ]; then
  stale=$(cat "$PID_FILE" 2>/dev/null || true)
  if [ -n "${stale:-}" ] && kill -0 "$stale" 2>/dev/null; then
    echo "init: killing stale mint process $stale from $PID_FILE"
    kill "$stale" 2>/dev/null || true
    sleep 1
    kill -9 "$stale" 2>/dev/null || true
  fi
  rm -f "$PID_FILE"
fi

# Kill anything else bound to $PORT (covers the case where a prior mint was
# not started by this script). Skip if lsof is not available.
if command -v lsof >/dev/null 2>&1; then
  existing=$(lsof -ti tcp:"$PORT" 2>/dev/null || true)
  if [ -n "$existing" ]; then
    echo "init: killing existing process(es) on port $PORT: $existing"
    # shellcheck disable=SC2086
    kill $existing 2>/dev/null || true
    sleep 1
    # shellcheck disable=SC2086
    kill -9 $existing 2>/dev/null || true
  fi
fi

# Prerequisite: the `mint` CLI must already be on PATH.
if ! command -v mint >/dev/null 2>&1; then
  echo "init: 'mint' CLI not on PATH — install it with 'npm i -g mint' (prerequisite, out of scope for this script)" >&2
  exit 1
fi

# Start the dev server in the background.
: > "$LOG_FILE"
mint dev --port "$PORT" >>"$LOG_FILE" 2>&1 &
mint_pid=$!
echo "$mint_pid" > "$PID_FILE"

# Wait up to 120s for HTTP 200 on the root.
ready=0
deadline=$(( $(date +%s) + 120 ))
while [ "$(date +%s)" -lt "$deadline" ]; do
  code=$(curl -s -o /dev/null -w '%{http_code}' "http://localhost:${PORT}/" 2>/dev/null || true)
  if [ "$code" = "200" ]; then
    ready=1
    break
  fi
  if ! kill -0 "$mint_pid" 2>/dev/null; then
    echo "init: mint process exited before becoming ready; tail of $LOG_FILE:" >&2
    tail -n 50 "$LOG_FILE" >&2 || true
    exit 1
  fi
  sleep 1
done

if [ "$ready" -ne 1 ]; then
  echo "init: timed out waiting for http://localhost:${PORT}/ to return HTTP 200" >&2
  tail -n 50 "$LOG_FILE" >&2 || true
  exit 1
fi

echo "READY http://localhost:${PORT}/"

# Run the broken-link check; propagate its exit code.
mint broken-links
rc=$?

exit "$rc"
