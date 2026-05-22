#!/usr/bin/env bash
# Reliable PM2 start — never use `pm2 restart school-os` after .env changes.
set -euo pipefail
cd "$(dirname "$0")/.."
exec bash scripts/vps-fix-now.sh
