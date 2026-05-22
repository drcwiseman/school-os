#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
set -a
source .env
set +a
export NODE_ENV="${NODE_ENV:-production}"
exec node dist/index.js
