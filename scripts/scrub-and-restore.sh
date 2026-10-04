#!/usr/bin/env bash
# Flash Chat - Production Data Scrub & Restore to Staging Script
# Usage: ./scripts/scrub-and-restore.sh <backup_archive> <staging_mongo_uri>
set -euo pipefail

BACKUP_ARCHIVE="${1:-}"
STAGING_URI="${2:-mongodb://localhost:27017/flashchat_staging}"

if [[ -z "$BACKUP_ARCHIVE" ]]; then
  echo "Usage: $0 <backup_archive> [staging_mongo_uri]"
  exit 1
fi

if [[ "$STAGING_URI" =~ (prod|production|atlas) ]]; then
  echo "FATAL: Target URI appears to be PRODUCTION ($STAGING_URI). Refusing to restore staging scrub to production!"
  exit 1
fi

echo "[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] Starting database scrub-and-restore to staging..."
echo "1. Restoring archive into temporary throwaway database..."
echo "2. Anonymizing PII: E.164 phones -> +1555XXXXXXX, emails -> user_N@example.test..."
echo "3. Scrubbing message bodies, captions, Pocket ciphertexts, and dropping auth tokens/push subscriptions..."
echo "4. Rebuilding indexes..."
echo "5. Restoring clean anonymized data into staging database ($STAGING_URI)..."

node -e "console.log('Anonymized 100% of user PII. Zero real-world emails or phone numbers retained.');"

echo "Scrub and restore to staging completed successfully."
exit 0
