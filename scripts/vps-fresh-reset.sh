#!/usr/bin/env bash
# DESTRUCTIVE: removes School OS app dirs, selected PM2 apps, and PostgreSQL school_os.
# Run on the VPS as root. Never touches the bclimax PM2 app.
#
#   CONFIRM_DESTROY=yes ./scripts/vps-fresh-reset.sh
#
# PM2 removed: school-os, kingdom-deliverance (and same names under bishopcl if present)
# PM2 kept:    bclimax
#
# Optional env:
#   DB_NAME=school_os   DB_USER=schoolos
#   REMOVE_ROOT_APP=1   REMOVE_BISHOPCL_APP=1
#   PM2_REMOVE_APPS="school-os kingdom-deliverance"
set -euo pipefail

if [ "$(id -u)" -ne 0 ]; then
  echo "ERROR: Run this script as root (not as bishopcl)."
  echo "  ssh root@YOUR_SERVER"
  echo "  cd /root/school-os && CONFIRM_DESTROY=yes ./scripts/vps-fresh-reset.sh"
  echo ""
  echo "bishopcl has a separate PM2 — 'pm2 list' as bishopcl does NOT show root's bclimax app."
  exit 1
fi

PM2_KEEP="bclimax"
PM2_REMOVE_APPS="${PM2_REMOVE_APPS:-school-os kingdom-deliverance}"

if [ "${CONFIRM_DESTROY:-}" != "yes" ]; then
  echo "This deletes School OS on this server:"
  echo "  - app dirs: /root/school-os, /home/bishopcl/school-os"
  echo "  - database: school_os (+ drizzle schema)"
  echo "  - PM2 apps: ${PM2_REMOVE_APPS}"
  echo "  - PM2 kept: ${PM2_KEEP} (not stopped, not deleted)"
  echo ""
  echo "Re-run with:  CONFIRM_DESTROY=yes $0"
  exit 1
fi

DB_NAME="${DB_NAME:-school_os}"
DB_USER="${DB_USER:-schoolos}"
REMOVE_ROOT_APP="${REMOVE_ROOT_APP:-1}"
REMOVE_BISHOPCL_APP="${REMOVE_BISHOPCL_APP:-1}"

pm2_remove_apps() {
  local who="$1"
  if ! command -v pm2 >/dev/null 2>&1; then
    return 0
  fi
  echo "==> PM2 on ${who} (before)"
  pm2 list 2>/dev/null || true
  for app in $PM2_REMOVE_APPS; do
    if [ "$app" = "$PM2_KEEP" ]; then
      echo "  · skip (protected): ${app}"
      continue
    fi
    pm2 stop "$app" 2>/dev/null || true
    pm2 delete "$app" 2>/dev/null || true
    echo "  · removed: ${app}"
  done
  pm2 save 2>/dev/null || true
  echo "==> PM2 on ${who} (after) — ${PM2_KEEP} must still be online"
  pm2 list 2>/dev/null || true
  if command -v pm2 >/dev/null 2>&1 && ! pm2 describe "$PM2_KEEP" &>/dev/null; then
    echo "WARNING: ${PM2_KEEP} is not in PM2 for ${who}. Check the app path and restart manually."
  fi
}

echo "==> PM2 cleanup as root (keep ${PM2_KEEP})"
pm2_remove_apps "root"

if id bishopcl &>/dev/null; then
  echo "==> PM2 cleanup as bishopcl (keep ${PM2_KEEP})"
  su - bishopcl -c "for a in ${PM2_REMOVE_APPS}; do [ \"\$a\" = '${PM2_KEEP}' ] && continue; pm2 delete \"\$a\" 2>/dev/null || true; done; pm2 save 2>/dev/null || true; pm2 list" || true
fi

if [ "$REMOVE_ROOT_APP" = "1" ] && [ -d /root/school-os ]; then
  echo "==> Removing /root/school-os"
  rm -rf /root/school-os
fi

if [ "$REMOVE_BISHOPCL_APP" = "1" ] && [ -d /home/bishopcl/school-os ]; then
  echo "==> Removing /home/bishopcl/school-os"
  rm -rf /home/bishopcl/school-os
fi

echo "==> Resetting PostgreSQL database: $DB_NAME"
if ! command -v psql >/dev/null 2>&1 && [ -x /usr/bin/psql ]; then
  PSQL=(/usr/bin/psql)
elif command -v psql >/dev/null 2>&1; then
  PSQL=(psql)
else
  echo "psql not found — drop database manually, then re-run install."
  exit 1
fi

sudo -u postgres "${PSQL[@]}" -v ON_ERROR_STOP=1 <<EOSQL
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE datname = '${DB_NAME}' AND pid <> pg_backend_pid();

DROP DATABASE IF EXISTS ${DB_NAME};
DROP SCHEMA IF EXISTS drizzle CASCADE;

DO \$\$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '${DB_USER}') THEN
    CREATE ROLE ${DB_USER} LOGIN PASSWORD 'CHANGE_ME_AFTER_INSTALL';
  END IF;
END
\$\$;

CREATE DATABASE ${DB_NAME} OWNER ${DB_USER};
EOSQL

sudo -u postgres "${PSQL[@]}" -d "$DB_NAME" -c "CREATE EXTENSION IF NOT EXISTS pgcrypto;" 2>/dev/null || \
  PGPASSWORD="${DB_PASSWORD:-}" psql -h 127.0.0.1 -U "$DB_USER" -d "$DB_NAME" -c "CREATE EXTENSION IF NOT EXISTS pgcrypto;" 2>/dev/null || true

echo ""
echo "✅ Reset complete."
echo "   Next: fresh install (see docs/CWP-MASMOBEST-MIGRATION.md — Fresh start)"
echo "   Set a real DB password in server/.env after install."
