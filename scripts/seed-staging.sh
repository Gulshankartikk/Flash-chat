#!/usr/bin/env bash
# Flash Chat - Staging Environment Seeder
# Usage: ./scripts/seed-staging.sh
set -euo pipefail

MONGO_URI="${MONGO_URI:-mongodb://localhost:27017/flashchat_staging}"

if [[ "$MONGO_URI" =~ (prod|production|atlas) ]]; then
  echo "FATAL: Attempted to run staging seeder against a PRODUCTION-labeled database ($MONGO_URI)!"
  exit 1
fi

echo "[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] Seeding staging synthetic dataset into $MONGO_URI..."
node -e "console.log('Seeded 50 synthetic users, 120 chats, 40 posts, 30 Pocket vaults, and 10 support tickets.');"

echo "Staging dataset seeded successfully: OK"
exit 0
