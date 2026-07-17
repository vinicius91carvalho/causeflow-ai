#!/usr/bin/env bash
set -euo pipefail
export PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:$HOME/.local/bin:$HOME/.local/share/mise/installs/node/24.16.0/bin:$PATH"

WORKDIR=/home/vinicius/projects/causeflow-ai-wt-root-web-oss-marketing
PORT=5171
LOG="$WORKDIR/.harness/wi-ac-004-qa-agent-website.log"
PIDFILE="$WORKDIR/.harness/app.pid"
mkdir -p "$WORKDIR/.harness"

if curl -sf -o /dev/null --max-time 2 "http://127.0.0.1:${PORT}/" 2>/dev/null; then
  echo "Ready http://127.0.0.1:${PORT}/ (already up)"
  exit 0
fi

if [ -f "$PIDFILE" ]; then
  old="$(cat "$PIDFILE")"
  if kill -0 "$old" 2>/dev/null; then
    echo "existing pid=$old still alive; waiting for health"
  else
    rm -f "$PIDFILE"
  fi
fi

if [ ! -f "$PIDFILE" ]; then
  : > "$LOG"
  cd "$WORKDIR/web/apps/website"
  setsid env PORT="$PORT" pnpm exec next start -H 127.0.0.1 -p "$PORT" >>"$LOG" 2>&1 < /dev/null &
  echo $! > "$PIDFILE"
  printf '%s\n' "{\"at\":\"$(date -Iseconds)\",\"kind\":\"wi-ac-004-qa-website\",\"context\":\"web-oss-marketing\",\"port\":$PORT,\"workdir\":\"$WORKDIR\",\"pids\":[$(cat "$PIDFILE")],\"shared\":false,\"log\":\"$LOG\"}" >> "$WORKDIR/.harness/runtime-owned.jsonl"
fi

ready=0
for i in $(seq 1 60); do
  code=$(curl -sS -o /dev/null -w '%{http_code}' --max-time 2 "http://127.0.0.1:${PORT}/" 2>/dev/null || echo 000)
  if [ "$code" = "200" ] || [ "$code" = "304" ]; then
    echo "Ready http://127.0.0.1:${PORT}/ (try=$i code=$code)"
    ready=1
    break
  fi
  if grep -q 'Ready' "$LOG" 2>/dev/null; then
    code=$(curl -sS -o /dev/null -w '%{http_code}' --max-time 3 "http://127.0.0.1:${PORT}/" 2>/dev/null || echo 000)
    if [ "$code" = "200" ] || [ "$code" = "304" ]; then
      echo "Ready http://127.0.0.1:${PORT}/ (try=$i code=$code)"
      ready=1
      break
    fi
  fi
  sleep 1
done

if [ "$ready" != "1" ]; then
  echo "TIMEOUT waiting for Ready on :$PORT"
  tail -n 100 "$LOG" || true
  exit 1
fi

echo "pid=$(cat "$PIDFILE") node=$(node -v)"
tail -n 15 "$LOG"
