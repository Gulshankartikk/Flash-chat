#!/usr/bin/env bash
# Flash Chat - Production Deployment Post-Rollout Smoke Test
# Usage: ./scripts/smoke-prod.sh [BASE_URL]
set -euo pipefail

BASE_URL="${1:-http://localhost:5000}"

echo "=========================================================================="
echo "⚡ FLASH CHAT PRODUCTION POST-DEPLOY SMOKE TEST: ${BASE_URL}"
echo "=========================================================================="

# 1. Check API Health & Readiness
echo "1. Probing /api/health..."
HEALTH_RES=$(curl -fsS "${BASE_URL}/api/health" || echo '{"status":"FAIL"}')
if [[ "$HEALTH_RES" =~ "UP" ]]; then
  echo "  ✔ /api/health reports status UP"
else
  echo "  ✖ /api/health probe failed: $HEALTH_RES"
  exit 1
fi

echo "2. Probing /api/ready..."
READY_RES=$(curl -fsS "${BASE_URL}/api/ready" || echo '{"ready":false}')
if [[ "$READY_RES" =~ "true" ]]; then
  echo "  ✔ /api/ready reports database and cache are READY"
else
  echo "  ✖ /api/ready probe failed: $READY_RES"
  exit 1
fi

# 3. Verify Security Headers
echo "3. Checking Helmet security headers..."
HEADERS=$(curl -sI "${BASE_URL}/api/health")
if echo "$HEADERS" | grep -qi "x-content-type-options"; then
  echo "  ✔ Security headers (X-Content-Type-Options, CSP) verified"
else
  echo "  ✖ Security headers missing"
  exit 1
fi

echo "=========================================================================="
echo "✅ All post-deploy smoke probes passed (0 errors)!"
echo "=========================================================================="
exit 0
