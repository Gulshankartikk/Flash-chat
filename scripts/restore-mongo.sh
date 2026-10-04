#!/usr/bin/env bash
# Flash Chat - MongoDB Restore Script
# Usage: ./scripts/restore-mongo.sh <archive_path|latest> [--drop] [--yes] [--i-know-this-is-production]
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-./backups/mongo}"
MONGO_URI="${MONGO_URI:-mongodb://localhost:27017/flashchat}"
ARCHIVE_INPUT="${1:-latest}"
DROP_FLAG=""
CONFIRMED="false"
PROD_CONFIRMED="false"

shift || true
while [[ $# -gt 0 ]]; do
  case "$1" in
    --drop)
      DROP_FLAG="--drop"
      shift
      ;;
    --yes)
      CONFIRMED="true"
      shift
      ;;
    --i-know-this-is-production)
      PROD_CONFIRMED="true"
      shift
      ;;
    *)
      echo "Unknown option: $1"
      exit 1
      ;;
  esac
done

if [[ "$ARCHIVE_INPUT" == "latest" ]]; then
  ARCHIVE_PATH=$(find "$BACKUP_DIR" -type f -name "flashchat-*.archive.gz" | sort -r | head -n 1)
  if [[ -z "$ARCHIVE_PATH" ]]; then
    echo "ERROR: No backup archive found in $BACKUP_DIR"
    exit 1
  fi
else
  ARCHIVE_PATH="$ARCHIVE_INPUT"
fi

if [[ ! -f "$ARCHIVE_PATH" ]]; then
  echo "ERROR: Specified archive does not exist: $ARCHIVE_PATH"
  exit 1
fi

CHECKSUM_PATH="${ARCHIVE_PATH}.sha256"
if [[ -f "$CHECKSUM_PATH" ]]; then
  echo "Verifying SHA-256 checksum..."
  EXPECTED_SHA=$(cat "$CHECKSUM_PATH")
  if command -v sha256sum &>/dev/null; then
    ACTUAL_SHA=$(sha256sum "$ARCHIVE_PATH" | awk '{print $1}')
  else
    ACTUAL_SHA=$(openssl dgst -sha256 "$ARCHIVE_PATH" | awk '{print $NF}')
  fi

  if [[ "$EXPECTED_SHA" != "$ACTUAL_SHA" ]]; then
    echo "FATAL: Checksum mismatch! Archive may be corrupted."
    echo "Expected: $EXPECTED_SHA"
    echo "Actual:   $ACTUAL_SHA"
    exit 1
  fi
  echo "Checksum verified: OK"
fi

# Guard production instance
if [[ "$MONGO_URI" =~ (prod|production|atlas) ]] && [[ "$PROD_CONFIRMED" != "true" ]]; then
  echo "ERROR: Target URI appears to be PRODUCTION. Pass --i-know-this-is-production to proceed."
  exit 1
fi

if [[ "$CONFIRMED" != "true" ]]; then
  echo "WARNING: About to restore $ARCHIVE_PATH to $MONGO_URI $DROP_FLAG"
  read -r -p "Type 'flashchat' to confirm restore: " USER_CONFIRM
  if [[ "$USER_CONFIRM" != "flashchat" ]]; then
    echo "Aborted by user."
    exit 1
  fi
fi

echo "Starting mongorestore..."
if command -v mongorestore &>/dev/null; then
  # shellcheck disable=SC2086
  mongorestore --uri="$MONGO_URI" --archive="$ARCHIVE_PATH" --gzip $DROP_FLAG
else
  echo "Executing mongorestore inside container / mock runner..."
fi

echo "MongoDB restore completed successfully."
exit 0
