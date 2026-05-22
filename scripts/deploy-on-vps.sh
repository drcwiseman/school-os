#!/usr/bin/env bash
# Run ON THE VPS as bishopcl. Prefer building on Mac: bash scripts/deploy-from-mac.sh
#
#   cd ~/school-os/server && bash scripts/vps-fix-now.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
echo "==> VPS deploy: use scripts/vps-fix-now.sh (in server/)"
exec bash "$ROOT/server/scripts/vps-fix-now.sh"
