#!/usr/bin/env bash
# Deploy School OS on InMotion VPS (run ON the server after git clone)
set -euo pipefail

APP_DIR="${APP_DIR:-$HOME/school-os}"
APP_DOMAIN="${APP_DOMAIN:-}"
NODE_VERSION="${NODE_VERSION:-20}"

echo "==> School OS deploy (InMotion VPS)"
echo "    APP_DIR=$APP_DIR"

if ! command -v git &>/dev/null; then
  echo "Install git first: sudo apt install -y git"
  exit 1
fi

# nvm + Node
if [ ! -d "$HOME/.nvm" ]; then
  curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
fi
# shellcheck disable=SC1091
source "$HOME/.nvm/nvm.sh"
nvm install "$NODE_VERSION"
nvm use "$NODE_VERSION"

if [ ! -d "$APP_DIR" ]; then
  git clone https://github.com/drcwiseman/school-os.git "$APP_DIR"
fi
cd "$APP_DIR"
git pull --ff-only || true

npm install
npm install --prefix server
npm install --prefix client

if [ ! -f server/.env ]; then
  cp server/.env.example server/.env
  SESSION_SECRET=$(openssl rand -hex 32 2>/dev/null || head -c 32 /dev/urandom | xxd -p -c 64)
  sed -i.bak "s|SESSION_SECRET=.*|SESSION_SECRET=$SESSION_SECRET|" server/.env
  sed -i.bak 's|NODE_ENV=development|NODE_ENV=production|' server/.env
  if [ -n "$APP_DOMAIN" ]; then
    sed -i.bak "s|CLIENT_ORIGIN=.*|CLIENT_ORIGIN=https://$APP_DOMAIN|" server/.env
  fi
  echo ""
  echo "!! Edit server/.env — set DATABASE_URL before continuing !!"
  echo "   nano $APP_DIR/server/.env"
  exit 1
fi

npm run build
npm run db:migrate

if ! command -v pm2 &>/dev/null; then
  npm install -g pm2
fi

pm2 delete school-os 2>/dev/null || true
pm2 start server/dist/index.js --name school-os --cwd "$APP_DIR/server"
pm2 save

echo ""
echo "==> Deployed. App listening on http://127.0.0.1:5000"
echo "    Configure Nginx to proxy your domain to port 5000 (see docs/INMOTION.md)"
if [ -n "$APP_DOMAIN" ]; then
  echo "    Set CLIENT_ORIGIN=https://$APP_DOMAIN in server/.env if not already"
fi
pm2 status
