#!/usr/bin/env bash
# Flash Chat - Image Digest Promotion Verification Script
# Usage: ./scripts/assert-same-digests.sh <staging_digest> <production_digest>
set -euo pipefail

STAGING_DIGEST="${1:-}"
PROD_DIGEST="${2:-}"

if [[ -z "$STAGING_DIGEST" ]] || [[ -z "$PROD_DIGEST" ]]; then
  echo "Usage: $0 <staging_digest> <production_digest>"
  exit 1
fi

if [[ "$STAGING_DIGEST" != "$PROD_DIGEST" ]]; then
  echo "FATAL ERROR: Digest mismatch! Production deployment must use the EXACT image digest verified in staging."
  echo "Staging Verified Digest:    $STAGING_DIGEST"
  echo "Production Request Digest:  $PROD_DIGEST"
  exit 1
fi

echo "Image digest promotion check PASSED ($STAGING_DIGEST == $PROD_DIGEST)."
exit 0
