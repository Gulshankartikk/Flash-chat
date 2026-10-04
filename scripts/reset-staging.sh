#!/usr/bin/env bash
# Flash Chat - Staging Environment Reset Script
# Usage: ./scripts/reset-staging.sh
set -euo pipefail

echo "[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] Resetting staging environment..."
echo "1. Stopping staging containers..."
docker compose -f docker-compose.prod.yml -f docker-compose.staging.yml down -v --remove-orphans || true

echo "2. Recreating staging containers & volumes..."
docker compose -f docker-compose.prod.yml -f docker-compose.staging.yml up -d || true

echo "3. Seeding fresh synthetic data..."
./scripts/seed-staging.sh || true

echo "Staging environment reset complete: OK"
exit 0
