#!/usr/bin/env bash
# Generate CycloneDX SBOM for the relay image.
#
# Requires syft >= 0.90 (https://github.com/anchore/syft)
#
# Usage:
#   ./scripts/sbom.sh <image-ref> <output-path>
#
set -euo pipefail

IMAGE_REF="${1:?usage: sbom.sh <image-ref> <output-path>}"
OUTPUT="${2:-sbom.cdx.json}"

syft "$IMAGE_REF" -o cyclonedx-json="$OUTPUT"
echo "SBOM written to $OUTPUT"
