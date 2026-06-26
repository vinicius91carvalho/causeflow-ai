#!/usr/bin/env bash
# Sign the relay container image with cosign (keyless via OIDC).
#
# Usage:
#   ./scripts/sign-image.sh <image-ref>
#
# Requires:
#   - cosign >= 2.0
#   - OIDC identity (CI runner) or GITHUB_TOKEN with id-token:write permission
#
set -euo pipefail

IMAGE_REF="${1:?usage: sign-image.sh <image-ref>}"
DIGEST="$(docker inspect --format='{{index .RepoDigests 0}}' "$IMAGE_REF")"

if [[ -z "$DIGEST" ]]; then
  echo "No digest found for $IMAGE_REF — push the image first"
  exit 1
fi

echo "Signing $DIGEST..."
COSIGN_EXPERIMENTAL=1 cosign sign --yes "$DIGEST"

echo "Generating provenance attestation..."
COSIGN_EXPERIMENTAL=1 cosign attest --yes \
  --predicate <(cat <<EOF
{
  "builder": { "id": "${CI_RUNNER_ID:-local}" },
  "buildType": "https://github.com/causeflow/relay@refs/heads/main",
  "invocation": {
    "parameters": {
      "commit": "$(git rev-parse HEAD)",
      "ref": "$(git rev-parse --abbrev-ref HEAD)"
    }
  }
}
EOF
) --type slsaprovenance "$DIGEST"

echo "Done."
