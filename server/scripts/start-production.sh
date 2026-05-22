#!/usr/bin/env bash
# Optional wrapper — prefer: ./scripts/pm2-start.sh (uses ecosystem.config.cjs)
set -euo pipefail
cd "$(dirname "$0")/.."
unset DATABASE_URL NODE_ENV PORT 2>/dev/null || true
set -a
# shellcheck disable=SC1091
source .env
set +a
export NODE_ENV="${NODE_ENV:-production}"
export PORT="${PORT:-5000}"
exec node dist/index.js
