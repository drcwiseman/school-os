#!/usr/bin/env bash
# Run ON THE SERVER as user bishopcl (after PostgreSQL is installed)
# APP_DOMAIN=masomobest.com ./scripts/deploy-cwp-bishopcl.sh
set -euo pipefail

APP_DIR="${APP_DIR:-$HOME/school-os}"
APP_DOMAIN="${APP_DOMAIN:-masomobest.com}"
PUBLIC_HTML="${PUBLIC_HTML:-$HOME/public_html}"
NODE_PORT="${NODE_PORT:-5000}"

echo "==> School OS deploy for $APP_DOMAIN"
echo "    APP_DIR=$APP_DIR"
echo "    PUBLIC_HTML=$PUBLIC_HTML"

if [ ! -f "$HOME/.nvm/nvm.sh" ]; then
  curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
fi
# shellcheck disable=SC1091
source "$HOME/.nvm/nvm.sh"
nvm install 20
nvm use 20
command -v pm2 >/dev/null || npm install -g pm2

if [ ! -d "$APP_DIR/.git" ]; then
  git clone https://github.com/drcwiseman/school-os.git "$APP_DIR"
fi
cd "$APP_DIR"
git pull --ff-only || true

npm install
npm install --prefix server
npm install --prefix client

if [ ! -f server/.env ]; then
  cp server/.env.example server/.env
  SECRET=$(openssl rand -hex 32 2>/dev/null || echo "change-me-$(date +%s)")
  sed -i "s|SESSION_SECRET=.*|SESSION_SECRET=$SECRET|" server/.env
  sed -i 's|NODE_ENV=development|NODE_ENV=production|' server/.env
  sed -i "s|CLIENT_ORIGIN=.*|CLIENT_ORIGIN=https://$APP_DOMAIN|" server/.env
  sed -i "s|PLATFORM_DOMAIN=.*|PLATFORM_DOMAIN=$APP_DOMAIN|" server/.env
  echo ""
  echo "EDIT server/.env — set DATABASE_URL, then run this script again."
  echo "  nano $APP_DIR/server/.env"
  exit 1
fi

npm run build
npm run db:repair --prefix server
npm run db:migrate

pm2 delete school-os 2>/dev/null || true
PORT="$NODE_PORT" pm2 start server/dist/index.js --name school-os --cwd "$APP_DIR/server"
pm2 save

mkdir -p "$PUBLIC_HTML"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
if [ -f "$SCRIPT_DIR/../deploy/cwp-public_html.htaccess" ]; then
  cp "$SCRIPT_DIR/../deploy/cwp-public_html.htaccess" "$PUBLIC_HTML/.htaccess"
else
  cat > "$PUBLIC_HTML/.htaccess" << EOF
RewriteEngine On
RewriteBase /
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule ^(.*)$ http://127.0.0.1:${NODE_PORT}/\$1 [P,L]
EOF
fi

echo ""
echo "✅ App on http://127.0.0.1:$NODE_PORT"
echo "✅ .htaccess installed in $PUBLIC_HTML"
echo "   Ask root to enable mod_proxy and restart httpd if the site does not load."
echo "   Open: https://$APP_DOMAIN"
