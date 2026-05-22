#!/usr/bin/env bash
# Fresh School OS install on CWP VPS (run as bishopcl after vps-fresh-reset.sh as root).
#
#   export APP_DOMAIN=masomobest.com
#   export DB_PASSWORD='your-strong-password'
#   ./scripts/vps-fresh-install.sh
#
# Root must have run reset + set postgres user password if needed:
#   sudo -u postgres psql -c "ALTER USER schoolos PASSWORD 'your-strong-password';"
set -euo pipefail

APP_DIR="${APP_DIR:-$HOME/school-os}"
APP_DOMAIN="${APP_DOMAIN:-masomobest.com}"
PUBLIC_HTML="${PUBLIC_HTML:-$HOME/public_html}"
NODE_PORT="${NODE_PORT:-5000}"
DB_NAME="${DB_NAME:-school_os}"
DB_USER="${DB_USER:-schoolos}"
DB_HOST="${DB_HOST:-127.0.0.1}"
RUN_SEED="${RUN_SEED:-1}"
REPO_URL="${REPO_URL:-https://github.com/drcwiseman/school-os.git}"

if [ -z "${DB_PASSWORD:-}" ]; then
  echo "Set DB_PASSWORD (must match PostgreSQL user ${DB_USER}):"
  echo "  export DB_PASSWORD='...'"
  echo "  sudo -u postgres psql -c \"ALTER USER ${DB_USER} PASSWORD '...';\""
  exit 1
fi

echo "==> Fresh install → https://${APP_DOMAIN}"
echo "    APP_DIR=${APP_DIR}"

if [ ! -f "$HOME/.nvm/nvm.sh" ]; then
  curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
fi
# shellcheck disable=SC1091
source "$HOME/.nvm/nvm.sh"
nvm install 20
nvm use 20
command -v pm2 >/dev/null || npm install -g pm2

if [ -d "$APP_DIR" ]; then
  echo "Remove existing app dir first (or use another APP_DIR): $APP_DIR"
  exit 1
fi

git clone "$REPO_URL" "$APP_DIR"
cd "$APP_DIR"
git pull --ff-only origin main 2>/dev/null || true

npm install
npm install --prefix server
npm install --prefix client

SESSION_SECRET=$(openssl rand -hex 32)
cat > server/.env <<EOF
NODE_ENV=production
PORT=${NODE_PORT}
DATABASE_URL=postgres://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:5432/${DB_NAME}
SESSION_SECRET=${SESSION_SECRET}
CLIENT_ORIGIN=https://${APP_DOMAIN}
PLATFORM_DOMAIN=${APP_DOMAIN}
INGRESS_CNAME_TARGET=${APP_DOMAIN}
USE_SUBDOMAIN=false
EOF

npm run build
npm run db:repair
npm run db:migrate
if [ "$RUN_SEED" = "1" ]; then
  npm run db:seed
  echo ""
  echo "Demo logins (change passwords in production):"
  echo "  Platform: https://${APP_DOMAIN}/platform/login"
  echo "    platform@schoolos.local / Platform123!"
  echo "  School A: https://${APP_DOMAIN}/s/school-a/login"
  echo "    admin@school-a.com / Password123!"
fi

pm2 delete school-os 2>/dev/null || true
PORT="$NODE_PORT" pm2 start server/dist/index.js --name school-os --cwd "$APP_DIR/server"
pm2 save

mkdir -p "$PUBLIC_HTML"
cp deploy/cwp-public_html.htaccess "$PUBLIC_HTML/.htaccess"

echo ""
echo "✅ Installed under ${APP_DIR}"
echo "   Node:  http://127.0.0.1:${NODE_PORT}"
echo "   Site:  https://${APP_DOMAIN}"
echo ""
echo "If Apache shows 502, ask root to add ProxyPass on the masomobest.com vhost"
echo "or enable mod_proxy + restart httpd."
