#!/usr/bin/env bash
# One-shot VPS repair: fix .env + start PM2. Run on server as bishopcl:
#   cd ~/school-os/server && bash scripts/vps-fix-now.sh
set -euo pipefail
cd "$(dirname "$0")/.."
APP_DIR="$(pwd)"
DB_PASS="${DB_PASS:-kitm}"

echo "==> Fixing server/.env"
sed -i 's|^NODE_ENV=.*|NODE_ENV=production|' .env
sed -i "s|^DATABASE_URL=.*|DATABASE_URL=postgres://schoolos:${DB_PASS}@127.0.0.1:5432/school_os|" .env
grep -E '^(DATABASE_URL|NODE_ENV)=' .env

if grep -qE '^DATABASE_URL=postgres://postgres[:@]' .env; then
  echo "ERROR: DATABASE_URL still uses postgres user — edit .env manually"
  exit 1
fi

if [[ ! -f dist/index.js ]]; then
  echo ""
  echo "ERROR: $APP_DIR/dist/index.js is missing."
  echo "On your Mac, run:  cd /path/to/SchoolOS && bash scripts/deploy-from-mac.sh"
  echo "Or rsync only:       rsync -avz -e 'ssh -p 2222' server/dist/ $HOST:~/school-os/server/dist/"
  exit 1
fi

echo "==> PM2: delete old process, start Node"
pm2 delete school-os 2>/dev/null || true

# Prefer ecosystem if present and valid; else direct start
if node -e "
  const c=require('./ecosystem.config.cjs');
  if (!c.apps?.[0]?.script) process.exit(1);
" 2>/dev/null; then
  pm2 start ecosystem.config.cjs
else
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
  export NODE_ENV="${NODE_ENV:-production}"
  export PORT="${PORT:-5000}"
  pm2 start dist/index.js --name school-os --cwd "$APP_DIR"
fi

pm2 save

sleep 3
echo ""
pm2 describe school-os 2>/dev/null | grep -E 'script path|status|restarts' || pm2 list
echo ""
echo "==> Health:"
if curl -sS "http://127.0.0.1:5000/api/health"; then
  echo ""
else
  echo ""
  echo "FAILED — check: pm2 logs school-os --lines 40"
  exit 1
fi
echo ""
