#!/usr/bin/env bash
# init.sh — monorepo-root OSS umbrella lifecycle (AC-063 / AC-067).
#
# Fail-closed: requires Docker + the Docker Compose plugin before any compose
# work. Subcommands: start (default), stop, restart, status, help.
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

# True when this umbrella compose project already has `service` running and
# publishing host `port`. Foreign stacks (e.g. core-causeflow-api-1 on :3099)
# must NOT count - a healthy /health alone is not ownership.
umbrella_service_owns_port() {
  local port="$1"
  local service="$2"
  local line
  line="$(
    docker compose -f "$COMPOSE_FILE" ps --status running --format '{{.Service}} {{.Ports}}' 2>/dev/null \
      | awk -v svc="$service" '$1 == svc { print; exit }'
  )"
  [ -n "$line" ] || return 1
  # Match host publish forms: 0.0.0.0:3099->..., [::]:3099->...
  echo "$line" | grep -qE ":${port}->"
}

# Any listener on a required port is a conflict unless it is the matching
# umbrella service. Do not skip solely because a foreign /health returns 200.
check_ports_free_for_unhealthy() {
  local conflicts=()
  if port_in_use 3000 && ! umbrella_service_owns_port 3000 causeflow-website; then
    conflicts+=(3000)
  fi
  if port_in_use 3001 && ! umbrella_service_owns_port 3001 causeflow-dashboard; then
    conflicts+=(3001)
  fi
  if port_in_use 3099 && ! umbrella_service_owns_port 3099 causeflow-api; then
    conflicts+=(3099)
  fi
  if port_in_use 5181 && ! umbrella_service_owns_port 5181 causeflow-docs; then
    conflicts+=(5181)
  fi
  if [ "${#conflicts[@]}" -gt 0 ]; then
    echo "ERROR: required ports already in use: ${conflicts[*]}" >&2
    echo "Stop the conflicting listeners and retry, for example:" >&2
    echo "  docker compose -f \"${COMPOSE_FILE}\" rm -sf causeflow-website causeflow-dashboard causeflow-api causeflow-docs" >&2
    echo "  docker compose -f \"${ROOT}/core/docker-compose.yml\" stop causeflow-api" >&2
    echo "  docker compose -f \"${ROOT}/core/docker-compose.yml\" down" >&2
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

require_compose_file() {
  if [ ! -f "$COMPOSE_FILE" ]; then
    echo "ERROR: missing ${COMPOSE_FILE}" >&2
    exit 1
  fi
}

usage() {
  cat <<EOF
Usage: ./init.sh [start|stop|restart|status|help]

  start    (default) bring up the umbrella stack and wait until Ready
  stop     stop umbrella compose services (idempotent)
  restart  stop then start
  status   exit 0 when all health URLs respond; print compose ps
  help     show this usage and the local URL matrix

Relay is not managed here — see relay/README.md and relay/init.sh.
EOF
  print_url_matrix
}

cmd_start() {
  require_docker
  require_compose_file

  # Refuse foreign listeners before any Ready short-circuit. A process that
  # answers the health URLs on :3000/:3001/:3099/:5181 is not enough — the
  # matching umbrella compose service must own the publish (AC-067 / AC-063).
  check_ports_free_for_unhealthy

  if stack_ready; then
    echo "Ready (already up)"
    print_url_matrix
    exit 0
  fi

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
}

cmd_stop() {
  require_docker
  require_compose_file

  echo "Stopping CauseFlow OSS umbrella stack..."
  docker compose -f "$COMPOSE_FILE" stop || true
  docker compose -f "$COMPOSE_FILE" ps -a 2>/dev/null || true
}

cmd_status() {
  require_docker
  require_compose_file

  local ready=0
  if stack_ready; then
    ready=1
  fi
  echo "ready=${ready}"
  docker compose -f "$COMPOSE_FILE" ps 2>/dev/null || true
  print_url_matrix
  [ "$ready" -eq 1 ]
}

cmd="${1:-start}"
case "$cmd" in
  start) cmd_start ;;
  stop) cmd_stop ;;
  restart) cmd_stop; cmd_start ;;
  status) cmd_status ;;
  help|-h|--help) usage ;;
  *)
    usage >&2
    exit 2
    ;;
esac
