#!/usr/bin/env bash
# Flash Chat - Maintenance Mode Toggle Script
# Usage: ./scripts/maintenance.sh <on|off>
set -euo pipefail

ACTION="${1:-}"
MAINTENANCE_FLAG="/tmp/flashchat-maintenance.flag"

if [[ "$ACTION" != "on" && "$ACTION" != "off" ]]; then
  echo "Usage: $0 <on|off>"
  exit 1
fi

if [[ "$ACTION" == "on" ]]; then
  touch "$MAINTENANCE_FLAG"
  echo "[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] Maintenance mode ENABLED. New HTTP requests will receive 503 Service Unavailable."
else
  rm -f "$MAINTENANCE_FLAG"
  echo "[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] Maintenance mode DISABLED. Normal traffic resumed."
fi

exit 0
