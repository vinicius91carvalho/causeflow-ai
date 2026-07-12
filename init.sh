#!/usr/bin/env bash
# init.sh — monorepo-root OSS umbrella bring-up (AC-063 / AC-067).
#
# Fail-closed: requires Docker + the Docker Compose plugin before any compose
# work. Starts `docker compose up -d` from this directory, waits until the
# stack is ready, prints a local URL matrix, and exits 0.
#
# Does NOT start the relay. Relay remains optional via relay/README.md and
# relay/init.sh only.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

COMPOSE_FILE="${ROOT}/docker-compose.yml"
WAIT_SECONDS="${INIT_WAIT_SECONDS:-300}"

WEBSITE_URL="http://localhost:3000"
DASHBOARD_URL="http://localhost:3001"
API_URL="http://localhost:3099"
DOCS_URL="http://localhost:5181"

WEBSITE_HEALTH_URL="${WEBSITE_URL}/"
DASHBOARD_HEALTH_URL="${DASHBOARD_URL}/auth/sign-in"
API_HEALTH_URL="${API_URL}/health"
DOCS_HEALTH_URL="${DOCS_URL}/"

print_url_matrix() {
  cat <<EOF
CauseFlow local URL matrix
  Website:   ${WEBSITE_URL}
  Dashboard: ${DASHBOARD_URL}  (health: ${DASHBOARD_HEALTH_URL})
  API:       ${API_URL}  (health: ${API_HEALTH_URL})
  Docs:      ${DOCS_URL}
EOF
}

http_ok() {
  local url="$1"
  local code
  code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 3 "$url" 2>/dev/null || echo 000)"
  case "$code" in
    2*|3*) return 0 ;;
    *) return 1 ;;
  esac
}

stack_ready() {
  http_ok "$WEBSITE_HEALTH_URL" \
    && http_ok "$DASHBOARD_HEALTH_URL" \
    && http_ok "$API_HEALTH_URL" \
    && http_ok "$DOCS_HEALTH_URL"
}

require_docker() {
  if ! command -v docker >/dev/null 2>&1; then
    echo "ERROR: Docker is not installed or not on PATH." >&2
    echo "Install Docker Engine + the Compose plugin: https://docs.docker.com/get-docker/" >&2
    exit 1
  fi
  if ! docker info >/dev/null 2>&1; then
    echo "ERROR: Docker daemon is not reachable. Start Docker and retry." >&2
    echo "Install / start Docker: https://docs.docker.com/get-docker/" >&2
    exit 1
  fi
  if ! docker compose version >/dev/null 2>&1; then
    echo "ERROR: Docker Compose plugin is not available (try: docker compose version)." >&2
    echo "Install the Compose plugin: https://docs.docker.com/compose/install/" >&2
    exit 1
  fi
}

port_in_use() {
  local port="$1"
  if command -v ss >/dev/null 2>&1; then
    ss -tlnH "sport = :${port}" 2>/dev/null | grep -q . && return 0
    return 1
  fi
  if command -v lsof >/dev/null 2>&1; then
    lsof -iTCP:"${port}" -sTCP:LISTEN >/dev/null 2>&1 && return 0
    return 1
  fi
  # Best-effort fallback when neither ss nor lsof is present.
  curl -s -o /dev/null --max-time 1 "http://127.0.0.1:${port}/" 2>/dev/null && return 0
  return 1
}

# Ports whose health probe is not yet passing must be free for compose to bind.
check_ports_free_for_unhealthy() {
  local conflicts=()
  if ! http_ok "$WEBSITE_HEALTH_URL" && port_in_use 3000; then
    conflicts+=(3000)
  fi
  if ! http_ok "$DASHBOARD_HEALTH_URL" && port_in_use 3001; then
    conflicts+=(3001)
  fi
  if ! http_ok "$API_HEALTH_URL" && port_in_use 3099; then
    conflicts+=(3099)
  fi
  if ! http_ok "$DOCS_HEALTH_URL" && port_in_use 5181; then
    conflicts+=(5181)
  fi
  if [ "${#conflicts[@]}" -gt 0 ]; then
    echo "ERROR: required ports already in use: ${conflicts[*]}" >&2
    echo "Stop the conflicting listeners and retry, for example:" >&2
    echo "  docker compose -f \"${COMPOSE_FILE}\" rm -sf causeflow-website causeflow-dashboard causeflow-api causeflow-docs" >&2
    echo "  ss -tlnp | grep -E ':(${conflicts[*]// /|})\\b'" >&2
    exit 1
  fi
}

fail_compose() {
  echo "ERROR: compose stack did not become ready (or compose failed)." >&2
  docker compose -f "$COMPOSE_FILE" ps -a >&2 || true
  docker compose -f "$COMPOSE_FILE" logs --tail=100 >&2 || true
  exit 1
}

# --- main ---
require_docker

if [ ! -f "$COMPOSE_FILE" ]; then
  echo "ERROR: missing ${COMPOSE_FILE}" >&2
  exit 1
fi

if stack_ready; then
  echo "Ready (already up)"
  print_url_matrix
  exit 0
fi

check_ports_free_for_unhealthy

echo "Starting CauseFlow OSS umbrella stack (relay excluded)..."
if ! docker compose -f "$COMPOSE_FILE" up -d; then
  fail_compose
fi

deadline=$((SECONDS + WAIT_SECONDS))
while (( SECONDS < deadline )); do
  if stack_ready; then
    echo "Ready"
    print_url_matrix
    # Confirm relay was not started by this path.
    if docker compose -f "$COMPOSE_FILE" ps -a --format '{{.Name}} {{.Service}}' 2>/dev/null | grep -qi relay; then
      echo "ERROR: relay service present in root compose runtime; root init must not start relay." >&2
      exit 1
    fi
    exit 0
  fi
  sleep 2
done

fail_compose
