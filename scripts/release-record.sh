#!/usr/bin/env bash
set -euo pipefail

# Flash Chat - Production Release Record CLI Wrapper
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

node "${SCRIPT_DIR}/release-record.js" "$@"
