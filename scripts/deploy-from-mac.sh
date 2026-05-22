#!/usr/bin/env bash
# Run on your Mac from the SchoolOS repo root — builds locally, uploads to VPS, restarts PM2.
# InMotion SSH is usually port 2222, not 22.
#
#   bash scripts/deploy-from-mac.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

HOST="${VPS_HOST:-bishopcl@173.231.241.161}"
PORT="${VPS_PORT:-2222}"
SSH_OPTS=(-p "$PORT")
RSYNC_SSH="ssh -p $PORT"

echo "==> Build on Mac"
npm run build --prefix server
npm run build --prefix client

echo "==> Upload to $HOST:~/school-os/ (SSH port $PORT)"
rsync -avz -e "$RSYNC_SSH" \
  --exclude node_modules \
  --exclude .git \
  "$ROOT/" "$HOST:~/school-os/"

echo "==> Restart on VPS"
ssh "${SSH_OPTS[@]}" "$HOST" 'bash ~/school-os/server/scripts/vps-fix-now.sh'

echo ""
echo "Deploy complete. Hard-refresh the browser."
