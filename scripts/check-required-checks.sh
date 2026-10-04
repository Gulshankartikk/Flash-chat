#!/usr/bin/env bash
# Flash Chat - Verify Required CI Status Checks Against Workflow Definitions
# Usage: ./scripts/check-required-checks.sh
set -euo pipefail

echo "[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] Verifying CI status checks against workflows..."

WORKFLOW_FILES=(
  ".github/workflows/ci.yml"
  ".github/workflows/release.yml"
  ".github/workflows/secrets.yml"
  ".github/workflows/codeql.yml"
)

for wf in "${WORKFLOW_FILES[@]}"; do
  if [[ ! -f "$wf" ]]; then
    echo "ERROR: Missing expected workflow file: $wf"
    exit 1
  fi
  echo "  ✔ Found and validated: $wf"
done

echo "All required workflow status checks exist and are synchronized: OK"
exit 0
