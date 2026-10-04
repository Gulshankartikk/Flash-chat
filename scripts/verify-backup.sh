#!/usr/bin/env bash
# Flash Chat - Automated Backup Verification Script
# Usage: ./scripts/verify-backup.sh
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-./backups/mongo}"
TEST_PORT="27018"
TEST_CONTAINER="flashchat-mongo-verify-tmp"

echo "Locating latest backup archive..."
LATEST_ARCHIVE=$(find "$BACKUP_DIR" -type f -name "flashchat-*.archive.gz" | sort -r | head -n 1)

if [[ -z "$LATEST_ARCHIVE" ]]; then
  echo "ERROR: No backup found to verify."
  exit 1
fi

echo "Verifying archive integrity: $LATEST_ARCHIVE"
./scripts/restore-mongo.sh "$LATEST_ARCHIVE" --yes

echo "Backup verification finished with status: OK"
exit 0
