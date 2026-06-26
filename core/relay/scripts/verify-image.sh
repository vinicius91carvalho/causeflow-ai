#!/usr/bin/env bash
# Verify a signed relay image before running it in customer networks.
#
# Usage:
#   ./scripts/verify-image.sh <image-ref> <expected-identity> <expected-issuer>
#
set -euo pipefail

IMAGE_REF="${1:?usage: verify-image.sh <image-ref> <expected-identity> <expected-issuer>}"
IDENTITY="${2:?expected OIDC identity}"
ISSUER="${3:?expected OIDC issuer}"

cosign verify \
  --certificate-identity "$IDENTITY" \
  --certificate-oidc-issuer "$ISSUER" \
  "$IMAGE_REF"

echo "Signature OK."
