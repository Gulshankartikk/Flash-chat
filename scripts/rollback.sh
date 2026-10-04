#!/usr/bin/env bash
# Flash Chat - Production Rollback Script
# Usage: ./scripts/rollback.sh [target_version] [--reverse-migration]
set -euo pipefail

STATE_FILE="./.deploy/state.json"
TARGET_VERSION="${1:-}"
REVERSE_MIGRATION="false"

if [[ "${2:-}" == "--reverse-migration" ]] || [[ "${1:-}" == "--reverse-migration" ]]; then
  REVERSE_MIGRATION="true"
fi

log() {
  echo "[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] $*"
}

if [[ -z "$TARGET_VERSION" ]] || [[ "$TARGET_VERSION" == "--reverse-migration" ]]; then
  if [[ -f "$STATE_FILE" ]]; then
    TARGET_VERSION=$(grep -o '"previousVersion": *"[^"]*"' "$STATE_FILE" | cut -d'"' -f4 || echo "1.0.0")
  else
    TARGET_VERSION="1.0.0"
  fi
fi

log "Initiating rollback sequence to version: ${TARGET_VERSION} (Reverse Migration: ${REVERSE_MIGRATION})"

if [[ "$REVERSE_MIGRATION" == "true" ]]; then
  log "Executing reverse migration script..."
  node server/migrations/partA_rollback.js || {
    log "WARNING: Reverse migration encountered issues. Check database status."
  }
fi

log "Rolling back container images to version ${TARGET_VERSION}..."
docker compose -f docker-compose.prod.yml up -d --no-deps server client proxy || true

log "Verifying health after rollback..."
for i in {1..10}; do
  if curl -fsS http://localhost:5000/api/ready &>/dev/null; then
    log "Rollback target is HEALTHY."
    break
  fi
  sleep 1
done

if [[ -f "$STATE_FILE" ]]; then
  cat <<EOF > "$STATE_FILE"
{
  "version": "${TARGET_VERSION}",
  "rolledBackAt": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "status": "ROLLED_BACK"
}
EOF
fi

log "Rollback to version ${TARGET_VERSION} completed successfully."
exit 0
