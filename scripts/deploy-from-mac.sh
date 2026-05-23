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

LOCAL_BUILD=$(grep -o 'assets/index-[^"]*\.js' "$ROOT/client/dist/index.html" | head -1 || echo "unknown")
echo "Local client bundle: $LOCAL_BUILD"

echo "==> Upload to $HOST:~/school-os/ (SSH port $PORT)"
rsync -avz -e "$RSYNC_SSH" \
  --exclude node_modules \
  --exclude .git \
  --exclude 'server/.env' \
  "$ROOT/" "$HOST:~/school-os/"

echo "==> Restart on VPS"
ssh "${SSH_OPTS[@]}" "$HOST" 'bash ~/school-os/server/scripts/vps-fix-now.sh'

echo ""
echo "==> Verify live build (via SSH tunnel to Node)"
REMOTE_BUILD=$(ssh "${SSH_OPTS[@]}" "$HOST" "grep -o 'assets/index-[^\"]*\\.js' ~/school-os/client/dist/index.html 2>/dev/null | head -1" || true)
HEALTH=$(ssh "${SSH_OPTS[@]}" "$HOST" 'curl -sS http://127.0.0.1:5000/api/health' 2>/dev/null || true)
echo "Remote client bundle: ${REMOTE_BUILD:-unknown}"
echo "Health: $HEALTH"
echo ""
if [[ -n "$REMOTE_BUILD" && "$REMOTE_BUILD" != "$LOCAL_BUILD" ]]; then
  echo "WARNING: Mac built $LOCAL_BUILD but VPS has $REMOTE_BUILD — rsync may have failed partially."
fi
echo "Deploy complete."
echo "1) Open https://masomobest.com/api/health and confirm clientBuild matches $LOCAL_BUILD"
echo "2) Hard-refresh portal: Ctrl+Shift+R (or Safari Develop → Empty Caches)"
echo "3) If still old UI: try a private/incognito window"
