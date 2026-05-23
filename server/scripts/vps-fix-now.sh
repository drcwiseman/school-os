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

echo "==> Install server dependencies (picks up package.json changes from deploy)"
npm install --omit=dev --no-audit --no-fund

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

echo "==> Wait for API (up to 30s)"
for i in $(seq 1 15); do
  if curl -sf "http://127.0.0.1:5000/api/health" >/dev/null 2>&1; then
    break
  fi
  sleep 2
done
echo ""
pm2 describe school-os 2>/dev/null | grep -E 'script path|status|restarts' || pm2 list
echo ""
echo "==> Client bundle on disk:"
if [[ -f ../client/dist/index.html ]]; then
  grep -o 'assets/index-[^"]*\.js' ../client/dist/index.html | head -1 || echo "(parse failed)"
else
  echo "MISSING ../client/dist/index.html — run deploy-from-mac.sh on your Mac"
fi
echo ""
echo "==> Schema / migrations (idempotent)"
node -e "require('./dist/db/ensure-runtime-schema').ensureRuntimeSchema().then(()=>console.log('schema ok')).catch(e=>{console.error(e);process.exit(1)})"
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
