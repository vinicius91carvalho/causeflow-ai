#!/usr/bin/env bash
#
# Send Clerk invitations with redirect to accept-invitation page.
#
# Usage:
#   ./scripts/invite-users.sh user@example.com
#   ./scripts/invite-users.sh user1@example.com user2@example.com
#   ./scripts/invite-users.sh --csv users.csv
#   echo "user@example.com" | ./scripts/invite-users.sh --stdin
#
# CSV format: one email per line (no header needed)
#
# Environment:
#   CLERK_SECRET_KEY  — required (sk_test_... or sk_live_...)
#   DASHBOARD_URL     — optional (default: https://dashboard-staging.causeflow.ai)
#

set -euo pipefail

CLERK_KEY="${CLERK_SECRET_KEY:-}"
DASHBOARD="${DASHBOARD_URL:-https://dashboard-staging.causeflow.ai}"
REDIRECT_URL="${DASHBOARD}/auth/sign-up"
API="https://api.clerk.com/v1/invitations"

if [[ -z "$CLERK_KEY" ]]; then
  echo "Error: CLERK_SECRET_KEY not set"
  echo "Usage: CLERK_SECRET_KEY=sk_test_... $0 user@example.com"
  exit 1
fi

send_invite() {
  local email="$1"
  email=$(echo "$email" | tr -d '[:space:]' | tr -d '"' | tr -d "'")

  # Skip empty lines and comments
  [[ -z "$email" || "$email" == \#* ]] && return

  local response
  response=$(curl -s -w "\n%{http_code}" -X POST "$API" \
    -H "Authorization: Bearer $CLERK_KEY" \
    -H "Content-Type: application/json" \
    -d "{\"email_address\":\"$email\",\"redirect_url\":\"$REDIRECT_URL\",\"notify\":true}")

  local http_code body
  http_code=$(echo "$response" | tail -1)
  body=$(echo "$response" | sed '$d')

  if [[ "$http_code" == "200" ]]; then
    local id
    id=$(echo "$body" | python3 -c "import json,sys;print(json.load(sys.stdin).get('id',''))" 2>/dev/null)
    echo "✅ $email — invited ($id)"
  elif echo "$body" | grep -q "duplicate"; then
    echo "⚠️  $email — already has pending invite"
  else
    local error
    error=$(echo "$body" | python3 -c "import json,sys;d=json.load(sys.stdin);print(d.get('errors',[{}])[0].get('long_message',d.get('errors',[{}])[0].get('message','unknown error')))" 2>/dev/null)
    echo "❌ $email — $error"
  fi
}

# Parse arguments
if [[ $# -eq 0 ]]; then
  echo "Usage:"
  echo "  $0 user@example.com [user2@example.com ...]"
  echo "  $0 --csv users.csv"
  echo "  echo 'user@example.com' | $0 --stdin"
  exit 1
fi

echo "Sending invites → $REDIRECT_URL"
echo ""

if [[ "$1" == "--csv" ]]; then
  if [[ ! -f "$2" ]]; then
    echo "Error: File $2 not found"
    exit 1
  fi
  while IFS= read -r email; do
    send_invite "$email"
  done < "$2"
elif [[ "$1" == "--stdin" ]]; then
  while IFS= read -r email; do
    send_invite "$email"
  done
else
  for email in "$@"; do
    send_invite "$email"
  done
fi

echo ""
echo "Done."
