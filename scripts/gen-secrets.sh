#!/usr/bin/env bash
# Flash Chat - Secure Random Secrets Generator
# Usage: ./scripts/gen-secrets.sh [--write <file>]
set -euo pipefail

WRITE_FILE=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --write)
      WRITE_FILE="$2"
      shift 2
      ;;
    *)
      echo "Unknown argument: $1"
      exit 1
      ;;
  esac
done

gen_hex() {
  local bytes="${1:-32}"
  if command -v openssl &>/dev/null; then
    openssl rand -hex "$bytes"
  else
    # Fallback to random node generator if openssl is unavailable
    node -e "console.log(require('crypto').randomBytes($bytes).toString('hex'))"
  fi
}

gen_base64() {
  local bytes="${1:-32}"
  if command -v openssl &>/dev/null; then
    openssl rand -base64 "$bytes" | tr -d '\n'
  else
    node -e "console.log(require('crypto').randomBytes($bytes).toString('base64'))"
  fi
}

JWT_ACCESS=$(gen_hex 32)
JWT_REFRESH=$(gen_hex 32)
MONGO_PASS=$(gen_hex 24)
REDIS_PASS=$(gen_hex 24)
TURN_SECRET=$(gen_hex 32)
ADMIN_BOOTSTRAP=$(gen_hex 16)

OUTPUT=$(cat <<EOF
# ==============================================================================
# Flash Chat - Generated Production Secrets ($(date -u +"%Y-%m-%dT%H:%M:%SZ"))
# ==============================================================================
JWT_ACCESS_SECRET=${JWT_ACCESS}
JWT_REFRESH_SECRET=${JWT_REFRESH}
MONGO_INITDB_ROOT_PASSWORD=${MONGO_PASS}
REDIS_PASSWORD=${REDIS_PASS}
TURN_SECRET=${TURN_SECRET}
ADMIN_BOOTSTRAP_TOKEN=${ADMIN_BOOTSTRAP}
EOF
)

if [[ -n "$WRITE_FILE" ]]; then
  if [[ -f "$WRITE_FILE" ]]; then
    echo "ERROR: Target file already exists ($WRITE_FILE). Refusing to overwrite existing secrets."
    exit 1
  fi
  echo "$OUTPUT" > "$WRITE_FILE"
  chmod 600 "$WRITE_FILE" 2>/dev/null || true
  echo "Secrets written securely to $WRITE_FILE (permissions set to 600)."
else
  echo "$OUTPUT"
fi

exit 0
