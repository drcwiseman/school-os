# Migrate School OS to `https://masomobest.com` (CWP / bishopcl)

| Item | Value |
|------|--------|
| **New domain** | `masomobest.com` (and `www.masomobest.com`) |
| **CWP user** | `bishopcl` |
| **Document root** | `/home/bishopcl/public_html` |
| **App code** | `/home/bishopcl/school-os` (not inside `public_html`) |
| **Node app** | `http://127.0.0.1:5000` via PM2 name `school-os` |

The app does **not** live in `public_html`. Only `.htaccess` (Apache proxy) sits there; Node runs from `school-os`.

---

## Beginner install — start here (root SSH)

You are on the server as **root** (`ssh root@173.231.241.161`). Follow these steps in order. Copy each block, paste, press Enter. Wait until each block finishes before the next.

**What you are building:** `https://masomobest.com` → Apache → Node app on port **5000**.  
**What stays safe:** PM2 app **`bclimax`** is never deleted.

### Step 0 — CWP panel (browser, not terminal)

1. Log in to **CentOS Web Panel**.
2. Add domain **masomobest.com** for user **bishopcl**, docroot `/home/bishopcl/public_html`.
3. Run **AutoSSL** for `masomobest.com`.
4. At your domain registrar, **A record** `masomobest.com` → `173.231.241.161`.

### Step 1 — Check bclimax (root terminal)

```bash
pm2 list
```

You should see **`bclimax`** with status **online**. That is correct. Leave it alone.

### Step 2 — Pick a database password

Choose one strong password. Example: `MasomoBest2026!`  
Use the **same** password in Steps 3 and 6. Below we call it `YOUR_DB_PASSWORD`.

### Step 3 — Clean old School OS only (root)

```bash
pm2 delete school-os 2>/dev/null || true
pm2 delete kingdom-deliverance 2>/dev/null || true
pm2 save
pm2 list
```

`bclimax` must still show **online**.

```bash
rm -rf /root/school-os /home/bishopcl/school-os
```

**Database (CWP — use `su - postgres`, not `sudo -u postgres` if you get “password authentication failed”):**

```bash
cd /tmp
su - postgres -c "psql" <<'EOSQL'
SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = 'school_os' AND pid <> pg_backend_pid();
DROP DATABASE IF EXISTS school_os;
DROP SCHEMA IF EXISTS drizzle CASCADE;
DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'schoolos') THEN
    CREATE ROLE schoolos LOGIN PASSWORD 'YOUR_DB_PASSWORD';
  END IF;
END $$;
ALTER USER schoolos PASSWORD 'YOUR_DB_PASSWORD';
CREATE DATABASE school_os OWNER schoolos;
EOSQL

su - postgres -c "psql -d school_os -c \"CREATE EXTENSION IF NOT EXISTS pgcrypto;\""
```

Replace **`YOUR_DB_PASSWORD`** twice (e.g. `MasomoBest2026!`).

If `su - postgres` fails, try interactive:

```bash
cd /tmp
su - postgres
psql
```

Then paste SQL lines one by one (same `DROP` / `CREATE` / `ALTER` as above), then `\q` to exit.

### Step 3c — CWP: “password authentication failed for user postgres”

On CWP, `psql` often asks for a **postgres password** you do not have. Use **one** of these:

**Option A — CWP panel (easiest)**

1. Log in to **CentOS Web Panel** as admin.
2. Open **SQL Services** → **PostgreSQL** (or **phpPgAdmin** / database manager).
3. Note or **reset** the PostgreSQL admin password.
4. As root:

```bash
cd /tmp
export PGPASSWORD='POSTGRES_PASSWORD_FROM_CWP'
psql -h 127.0.0.1 -U postgres -d postgres <<'EOSQL'
SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = 'school_os' AND pid <> pg_backend_pid();
DROP DATABASE IF EXISTS school_os;
DROP SCHEMA IF EXISTS drizzle CASCADE;
DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'schoolos') THEN
    CREATE ROLE schoolos LOGIN PASSWORD 'YOUR_DB_PASSWORD';
  END IF;
END $$;
ALTER USER schoolos PASSWORD 'YOUR_DB_PASSWORD';
CREATE DATABASE school_os OWNER schoolos;
EOSQL
psql -h 127.0.0.1 -U postgres -d school_os -c "CREATE EXTENSION IF NOT EXISTS pgcrypto;"
unset PGPASSWORD
```

**Option B — temporary trust (root, if panel password unknown)**

```bash
# Find config
find /var/lib/pgsql /usr/pgsql-* -name pg_hba.conf 2>/dev/null | head -3
```

Edit the file (example path `/var/lib/pgsql/data/pg_hba.conf`):

```bash
cp /var/lib/pgsql/data/pg_hba.conf /var/lib/pgsql/data/pg_hba.conf.bak
sed -i 's/^local\s\+all\s\+all\s\+peer/local   all             all                                     trust/' /var/lib/pgsql/data/pg_hba.conf
sed -i 's/^local\s\+all\s\+all\s\+md5/local   all             all                                     trust/' /var/lib/pgsql/data/pg_hba.conf
systemctl reload postgresql || systemctl reload postgresql-*
```

Run the `su - postgres -c "psql"` block from Step 3 again (no password prompt). Then **restore** the backup:

```bash
cp /var/lib/pgsql/data/pg_hba.conf.bak /var/lib/pgsql/data/pg_hba.conf
systemctl reload postgresql || systemctl reload postgresql-*
```

### Step 4 — Allow bishopcl to log in (root)

```bash
usermod -s /bin/bash bishopcl
passwd bishopcl
```

Set a Linux password for user `bishopcl` when asked (for `su` / SSH).

### Step 5 — Install app as bishopcl

```bash
su - bishopcl
```

Your prompt should change to `[bishopcl@vps138679 ~]$`.

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
source ~/.bashrc
nvm install 20
nvm use 20
npm install -g pm2

cd ~
git clone https://github.com/drcwiseman/school-os.git school-os
cd school-os

export APP_DOMAIN=masomobest.com
export DB_PASSWORD='YOUR_DB_PASSWORD'

chmod +x scripts/vps-fresh-install.sh 2>/dev/null || true
```

If the install script exists:

```bash
./scripts/vps-fresh-install.sh
```

If you see **No such file**, run the manual install block in [Step 5b — manual install](#step-5b--manual-install-if-script-missing) below.

When finished, stay as bishopcl and run:

```bash
curl -s http://127.0.0.1:5000/api/health
pm2 list
```

You should see **`school-os`** **online** and JSON from the health URL.

### Step 6 — Nginx proxy (required on this VPS; CWP has no clear “edit nginx” button)

**What’s going on**

- School OS runs on **`http://127.0.0.1:5000`** (PM2) — that part works.
- **Nginx** (not Apache) answers the internet on **`173.231.241.161:80`** and **`:443`**.
- `.htaccess` in `public_html` does **nothing** for visitors until nginx forwards traffic to port **5000**.

CWP often only shows **Apache** vhosts in the UI. You fix nginx **on the server as root** (SSH), not in `.htaccess`.

---

#### 6A — Find the nginx config file (root SSH)

```bash
grep -r masomobest /etc/nginx 2>/dev/null
grep -r bishopcl /etc/nginx/conf.d 2>/dev/null | head -20
ls -la /etc/nginx/conf.d/
```

Open the file that contains `server_name masomobest.com` (common paths):

- `/etc/nginx/conf.d/vhosts/masomobest.com.conf`
- `/etc/nginx/conf.d/users/bishopcl.conf`
- `/etc/nginx/conf.d/bishopcl/masomobest.com.conf`

```bash
NGINX_FILE=$(grep -rl 'server_name.*masomobest' /etc/nginx 2>/dev/null | head -1)
echo "Edit this file: $NGINX_FILE"
cat "$NGINX_FILE"
```

Copy the path it prints (e.g. `/etc/nginx/conf.d/vhosts/masomobest.com.conf`).

---

#### 6B — Add proxy block (root, `nano`)

```bash
cp "$NGINX_FILE" "${NGINX_FILE}.bak.$(date +%F)"
nano "$NGINX_FILE"
```

On this VPS the main vhost currently has `proxy_pass http://173.231.241.161:8181` (CWP → Apache).  
**Change only the first `server {` block** (`server_name masomobest.com www.masomobest.com`) to proxy **`http://127.0.0.1:5000`** instead.  
Do **not** change `webmail`, `mail`, or `cpanel` blocks.

Reference file: `deploy/nginx-masomobest-main-server.conf`

Inside that **first** **`server { ... }`** block, replace the whole `location / { ... }` (and remove `@backend`, `@custom`, php `location` in that block). Use:

```nginx
    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
```

Save in nano: `Ctrl+O`, Enter, `Ctrl+X`.

Snippet also in repo: `deploy/cwp-nginx-masomobest-proxy.conf`

**If the file already has `location / { root ... public_html`** — comment out or replace that block with the proxy block above so nginx does not serve static files instead of Node.

---

#### 6C — Test and reload nginx (root)

```bash
nginx -t
systemctl reload nginx
# or: systemctl restart nginx
```

```bash
curl -sI -H "Host: masomobest.com" http://173.231.241.161/ | head -8
curl -s http://127.0.0.1:5000/api/health
```

First command should show **`HTTP/1.1 200`** (or 304), not “connection refused”.

---

#### 6D — Optional: CWP panel (if your build has it)

Some CWP versions hide this under the **user**, not under “Nginx” globally:

1. **User Accounts** → **bishopcl** → **Modify** / **Edit**
2. Look for **Custom Webserver Configuration**, **Custom Nginx**, or **Additional nginx config**
3. Paste the same `location / { proxy_pass ... }` block there and save
4. **Restart Nginx** from CWP (or run `systemctl reload nginx` as root)

If you only see **Apache** custom config, use **6B** (edit file over SSH).

---

#### 6E — Frontend build (bishopcl)

Nginx can proxy even without the UI, but the homepage needs a built client:

```bash
su - bishopcl -c 'cd ~/school-os/server && npm run build && ./scripts/pm2-start.sh'
ls -la /home/bishopcl/school-os/client/dist/index.html
```

---

### Step 6 (legacy) — Apache `.htaccess` (does not apply on this VPS for public traffic)

**If `Permission denied` on `~/public_html/.htaccess`** — `public_html` is not owned by bishopcl. As **root**:

```bash
chown -R bishopcl:bishopcl /home/bishopcl/public_html
chmod 755 /home/bishopcl/public_html
```

Then as **bishopcl** (or use CWP File Manager → `public_html` → New file `.htaccess`):

```bash
cat > /home/bishopcl/public_html/.htaccess <<'EOF'
RewriteEngine On
RewriteBase /
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule ^(.*)$ http://127.0.0.1:5000/$1 [P,L]
EOF
```

**Or skip .htaccess** — in CWP → **WebServers Settings** → vhost **masomobest.com** → Custom conf:

```apache
ProxyPreserveHost On
ProxyPass / http://127.0.0.1:5000/
ProxyPassReverse / http://127.0.0.1:5000/
```

Reload Apache after saving.

### Step 7 — DNS (registrar)

For **masomobest.com** to reach this VPS (`173.231.241.161`):

| Record | Type | Value | Notes |
|--------|------|-------|--------|
| `@` | **A** | `173.231.241.161` | Required |
| `www` | **CNAME** → `masomobest.com` **or** A `173.231.241.161` | Either works |
| `@` | NS | your host NS | Leave as InMotion if that’s your registrar |

Optional (email): MX, SPF, DKIM — not required for the website.

**Remove or ignore** `localhost.masomobest.com` → `127.0.0.1` for public traffic (local only).

Check propagation on the server:

```bash
dig +short masomobest.com A
dig +short www.masomobest.com A
# both should show 173.231.241.161 (www may CNAME then A)
```

### Step 8 — Test in browser

| URL | Login (if you used seed) |
|-----|--------------------------|
| https://masomobest.com/ | Home page |
| https://masomobest.com/platform/login | `platform@schoolos.local` / `Platform123!` |
| https://masomobest.com/s/school-a/login | `admin@school-a.com` / `Password123!` |

**`ERR_FAILED` in Chrome** — work through this order on the server:

```bash
# 1) Node app must answer locally
curl -v http://127.0.0.1:5000/api/health
pm2 logs school-os --lines 40

# 2) Apache + docroot
ls -la /home/bishopcl/public_html/.htaccess
curl -sI -H "Host: masomobest.com" http://127.0.0.1/

# 3) DNS from server
dig +short masomobest.com A
```

In **CWP**: domain **masomobest.com** → user **bishopcl** → `/home/bishopcl/public_html` → **AutoSSL** issued.

If **502** or Apache does not proxy, as **root** in CWP add to the **masomobest.com** vhost:

```apache
ProxyPreserveHost On
ProxyPass / http://127.0.0.1:5000/
ProxyPassReverse / http://127.0.0.1:5000/
```

### Step 5b — Manual install (if script missing)

As **bishopcl**, after `git clone` and `export` lines above:

```bash
cd ~/school-os
npm install
npm install --prefix server
npm install --prefix client

cat > server/.env <<EOF
NODE_ENV=production
PORT=5000
DATABASE_URL=postgres://schoolos:YOUR_DB_PASSWORD@127.0.0.1:5432/school_os
SESSION_SECRET=$(openssl rand -hex 32)
CLIENT_ORIGIN=https://masomobest.com
PLATFORM_DOMAIN=masomobest.com
INGRESS_CNAME_TARGET=masomobest.com
USE_SUBDOMAIN=false
EOF

npm run db:migrate
npm run db:repair
npm run db:seed
npm run build

pm2 delete school-os 2>/dev/null || true
chmod +x scripts/pm2-start.sh
./scripts/pm2-start.sh
# Do NOT use `pm2 restart school-os` — use ./scripts/pm2-start.sh after .env or code changes
```

Replace `YOUR_DB_PASSWORD` in `server/.env` with your real password (same as Step 3 — **new** DB, not an old server URL).

**`DATABASE_URL`** should be: `postgres://schoolos:YOUR_PASSWORD@127.0.0.1:5432/school_os`

**PM2 path:** use `dist/index.js` with `--cwd ~/school-os/server`. Do not use `server/dist/...` with that cwd (doubles the path).

**PM2 trap:** Never use `pm2 restart school-os` after changing `.env` — it keeps stale env from `~/.pm2/dump.pm2`. Run `./scripts/pm2-start.sh` instead (deletes + starts `ecosystem.config.cjs` with fresh `.env`). `pm2 start ... --env DATABASE_URL=...` also does **not** set variables (PM2 `--env` is a profile name).

### Emergency: 503 / Connection refused (run on VPS as bishopcl)

Your `.env` must **not** use `postgres` as the DB user. PM2 must **not** use `scripts/start-production.sh` (old copies exit when they see `postgres://` in the URL).

```bash
cd ~/school-os/server
sed -i 's|^NODE_ENV=.*|NODE_ENV=production|' .env
sed -i 's|^DATABASE_URL=.*|DATABASE_URL=postgres://schoolos:YOUR_PASSWORD@127.0.0.1:5432/school_os|' .env
grep -E '^(DATABASE_URL|NODE_ENV)=' .env   # must show schoolos + production

npm run build
bash scripts/vps-fix-now.sh    # if missing, deploy from Mac (see below) or use manual pm2 block
```

**Where you run commands matters**

| Where you SSH | App path | Do **not** use |
|---------------|----------|----------------|
| **Mac** (Terminal.app) | `/Users/mindpace/Documents/SchoolOS` | `~/school-os` (not on Mac) |
| **VPS** (`bishopcl@vps138679`) | `~/school-os` | `/Users/mindpace/...` (Mac only) |

`rsync ... bishopcl@173.231.241.161:~/school-os/` is run **from your Mac**, not from inside the VPS.

**Option A — Deploy on the VPS** (you are already SSH’d in as `bishopcl`):

```bash
cd ~/school-os
git pull origin main    # if this repo is on GitHub and up to date
bash scripts/deploy-on-vps.sh
```

If there is no `git pull`, copy the project from your Mac once (Option B), then use Option A.

**Option B — Deploy from Mac (recommended)** — builds on Mac where `tsc` and Vite work, then uploads:

```bash
cd /Users/mindpace/Documents/SchoolOS
bash scripts/deploy-from-mac.sh
```

**Option C — rsync + VPS restart only** (after `npm run build` on Mac):

```bash
cd /Users/mindpace/Documents/SchoolOS
npm run build --prefix server && npm run build --prefix client
rsync -avz -e "ssh -p 2222" --exclude node_modules --exclude .git \
  ./ bishopcl@173.231.241.161:~/school-os/
ssh -p 2222 bishopcl@173.231.241.161 \
  'cd ~/school-os/server && pm2 delete school-os; pm2 start ecosystem.config.cjs; pm2 save; curl -sS http://127.0.0.1:5000/api/health'
```

**`sh: tsc: command not found` on VPS:** caused by `npm install --omit=dev` (no TypeScript). Use Option B/C, or on VPS: `cd ~/school-os/server && npm install && npm run build`.

**Client Vite/PostCSS build fails on VPS:** build on Mac, rsync, then `SKIP_CLIENT_BUILD=1 bash scripts/deploy-on-vps.sh`.

**Wrong:** running `rsync` **from inside** the VPS, or paths like `server/dist/` while cwd is already `~/school-os/server`.

**Manual PM2 (no scripts on server yet):**

```bash
cd ~/school-os/server
sed -i 's|^NODE_ENV=.*|NODE_ENV=production|' .env
sed -i 's|^DATABASE_URL=.*|DATABASE_URL=postgres://schoolos:YOUR_PASSWORD@127.0.0.1:5432/school_os|' .env
npm run build
pm2 delete school-os 2>/dev/null || true
NODE_ENV=production PORT=5000 \
  DATABASE_URL=postgres://schoolos:YOUR_PASSWORD@127.0.0.1:5432/school_os \
  pm2 start dist/index.js --name school-os --cwd ~/school-os/server
pm2 save
sleep 3 && curl -sS http://127.0.0.1:5000/api/health
```

Verify: `pm2 describe school-os` → `script path` must be `.../dist/index.js`, **not** `start-production.sh`.

**`npm error EMFILE`:** as root: `ulimit -n 65535` and add `* soft nofile 65535` to `/etc/security/limits.conf`, then log in again as bishopcl before `npm install --prefix client`.

---

## Overview

```text
Browser → https://masomobest.com
       → Apache (public_html/.htaccess)
       → http://127.0.0.1:5000 (PM2: school-os)
       → PostgreSQL (school_os database)
```

**Shared server (vps138679):** This box also runs the **bclimax** site. Fresh reset/install scripts **never** stop or delete the `bclimax` PM2 app. Only School OS and the old `kingdom-deliverance` PM2 entry are removed.

| PM2 name | Fresh reset |
|----------|-------------|
| **bclimax** | **Keep** — do not touch |
| **school-os** | Remove → reinstalled as `school-os` on port 5000 |
| **kingdom-deliverance** | Remove (errored legacy app) |

### Two PM2 instances (important)

**root** and **bishopcl** each have their **own** PM2. They do not share a process list.

| User | `pm2 list` shows | bclimax? |
|------|------------------|----------|
| **root** | `bclimax`, `school-os`, … | **Yes** — bclimax runs here |
| **bishopcl** | Often **empty** | **No** — empty table is normal |

So as `bishopcl@vps138679`:

```bash
pm2 list   # empty → does NOT mean bclimax was deleted
```

Check bclimax as **root**:

```bash
exit                    # leave bishopcl shell, or open a second SSH session
ssh root@vps138679      # or: su -
pm2 list                # you should see bclimax → online
```

You **cannot** `cd /root/school-os` as bishopcl (`Permission denied`). Reset and anything under `/root` must be run as **root**.

---

## Where to go next (you are on bishopcl now)

1. **Confirm bclimax** (root): `su -` then `pm2 list` → `bclimax` should be `online`.
2. **Fresh School OS for masomobest** — stay as **bishopcl**, install under your home (no `/root`):

```bash
cd ~
git clone https://github.com/drcwiseman/school-os.git school-os
cd school-os
export APP_DOMAIN=masomobest.com
export DB_PASSWORD='YOUR_DB_PASSWORD'   # set on root first (see step below)

chmod +x scripts/vps-fresh-install.sh
./scripts/vps-fresh-install.sh
```

3. **DB password** (once, as root):  
   `sudo -u postgres psql -c "ALTER USER schoolos PASSWORD 'YOUR_DB_PASSWORD';"`

4. **Only if** you still need to wipe the old School OS DB first — as **root** only:

```bash
cd /root/school-os
CONFIRM_DESTROY=yes ./scripts/vps-fresh-reset.sh
```

5. **Test:** `curl -s http://127.0.0.1:5000/api/health` and open `https://masomobest.com`

---

## Fresh start — delete School OS and reinstall (masomobest.com)

Use this when migrations/DB are broken and you want a **clean** `masomobest.com` deploy.

**Removed**

- `/root/school-os` and `/home/bishopcl/school-os`
- PostgreSQL database `school_os` (+ `drizzle` migration schema)
- PM2: `school-os`, `kingdom-deliverance` (root and bishopcl users)

**Not touched**

- PM2 **`bclimax`** (other business site on this VPS)
- bclimax databases, vhosts, or `public_html` for bclimax domains

### 0. CWP (panel)

1. Domain **masomobest.com** → user **bishopcl** → docroot `/home/bishopcl/public_html`
2. **AutoSSL** for `masomobest.com` + `www`
3. DNS **A** record → server IP

### 1. Reset (SSH as **root**)

```bash
# Optional backup first
pg_dump -h 127.0.0.1 -U schoolos -Fc school_os > /root/school_os_backup_$(date +%F).dump

# Clone repo only to run reset script, or curl the script from your machine after push
cd /root
rm -rf school-os
git clone https://github.com/drcwiseman/school-os.git school-os
cd school-os
git pull origin main

CONFIRM_DESTROY=yes ./scripts/vps-fresh-reset.sh
```

Confirm **bclimax** is still running — run as **root**, not bishopcl:

```bash
pm2 list
# bclimax → online
# school-os, kingdom-deliverance → gone until install step
```

Empty `pm2 list` on **bishopcl** is expected and unrelated to bclimax.

If `kingdom-deliverance` shows a different name in `pm2 list`, set it before reset:

```bash
PM2_REMOVE_APPS="school-os your-exact-kingdom-name" CONFIRM_DESTROY=yes ./scripts/vps-fresh-reset.sh
```

Ensure `bishopcl` can log in:

```bash
usermod -s /bin/bash bishopcl
passwd bishopcl
```

Set the DB password (pick a strong password):

```bash
export DB_PASS='YOUR_STRONG_PASSWORD'
sudo -u postgres psql -c "ALTER USER schoolos PASSWORD '${DB_PASS}';"
```

### 2. Install (SSH as **bishopcl**)

```bash
ssh bishopcl@YOUR_SERVER_IP

export APP_DOMAIN=masomobest.com
export DB_PASSWORD='YOUR_STRONG_PASSWORD'   # same as DB_PASS above

git clone https://github.com/drcwiseman/school-os.git ~/school-os
cd ~/school-os
git pull origin main
chmod +x scripts/vps-fresh-install.sh scripts/vps-fresh-reset.sh
./scripts/vps-fresh-install.sh
```

Skip demo schools in production: `RUN_SEED=0 ./scripts/vps-fresh-install.sh`

### 3. Apache proxy (if site does not load)

As **bishopcl**, `.htaccess` is installed by the install script. If you get **502**, as **root** in CWP add to the **masomobest.com** vhost:

```apache
ProxyPreserveHost On
ProxyPass / http://127.0.0.1:5000/
ProxyPassReverse / http://127.0.0.1:5000/
```

### 4. Verify

```bash
curl -s http://127.0.0.1:5000/api/health
```

| URL | Login (after seed) |
|-----|-------------------|
| https://masomobest.com/platform/login | `platform@schoolos.local` / `Platform123!` |
| https://masomobest.com/s/school-a/login | `admin@school-a.com` / `Password123!` |

Change all passwords after first login.

### Install under root instead (not recommended)

If you must keep the app under `/root/school-os`:

```bash
# After CONFIRM_DESTROY=yes reset as root:
cd /root
git clone https://github.com/drcwiseman/school-os.git school-os
cd school-os
export APP_DIR=/root/school-os APP_DOMAIN=masomobest.com DB_PASSWORD='...'
# Edit scripts/vps-fresh-install.sh APP_DIR or run deploy steps manually:
npm install && npm install --prefix server && npm install --prefix client
# create server/.env, npm run build, db:repair, db:migrate, db:seed, pm2 start ...
```

Prefer **bishopcl** + `/home/bishopcl/school-os` so the domain docroot and app user match CWP.

---

## Your VPS today (`/root/school-os`) — legacy layout

On **vps138679**, School OS may still live under **root** until you complete [Fresh start](#fresh-start--delete-school-os-and-reinstall-masomobestcom). **bclimax** stays on its own PM2 process regardless.

| What | Actual path / user |
|------|---------------------|
| **bclimax** (keep) | PM2 name `bclimax` — **do not delete** |
| School OS (replace) | `/root/school-os`, PM2 `school-os` |
| Legacy (remove on reset) | PM2 `kingdom-deliverance` |
| `bishopcl` home | `/home/bishopcl` — target for fresh install |
| `curl :5000/api/health` | School OS on port **5000** after install |

After fresh install, run everything as **bishopcl** under `/home/bishopcl/school-os`. Until then, use **root** only (do not run npm/pm2 as `bishopcl` without a clone):

```bash
# As root
cd /root/school-os
git pull origin main

# Confirm migration fix is present (should print a line with transport_routes)
grep -m1 transport_routes server/src/db/migrations/0022_phase_d.sql

npm run db:repair
npm run db:migrate
npm run build
pm2 restart school-os --update-env
pm2 save
curl -s http://127.0.0.1:5000/api/health
```

If `grep` finds **nothing**, the fix is **not on the server yet**. Either push from your dev machine (`git push origin main`) then `git pull` on the VPS, or run the emergency SQL in [Emergency fix without git pull](#emergency-fix-without-git-pull) below.

### Emergency fix without git pull

As **root**, create base tables once (uses `DATABASE_URL` from `server/.env`):

```bash
cd /root/school-os
sudo -u postgres psql -d school_os <<'EOSQL'
CREATE TABLE IF NOT EXISTS transport_routes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_at timestamp DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS transport_stops (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  route_id uuid NOT NULL REFERENCES transport_routes(id) ON DELETE CASCADE,
  name text NOT NULL,
  order_no integer DEFAULT 0 NOT NULL,
  lat text, lng text
);
CREATE TABLE IF NOT EXISTS transport_vehicles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  route_id uuid REFERENCES transport_routes(id),
  registration text NOT NULL,
  capacity integer
);
CREATE TABLE IF NOT EXISTS library_books (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  isbn text, title text NOT NULL, author text,
  created_at timestamp DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS library_copies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  book_id uuid NOT NULL REFERENCES library_books(id) ON DELETE CASCADE,
  barcode text NOT NULL,
  status text DEFAULT 'available' NOT NULL
);
CREATE TABLE IF NOT EXISTS library_loans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  copy_id uuid NOT NULL REFERENCES library_copies(id),
  student_id uuid REFERENCES students(id),
  loaned_at timestamp DEFAULT now() NOT NULL,
  due_at timestamp, returned_at timestamp
);
CREATE TABLE IF NOT EXISTS boarding_houses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_at timestamp DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS boarding_rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  house_id uuid NOT NULL REFERENCES boarding_houses(id) ON DELETE CASCADE,
  name text NOT NULL,
  capacity integer DEFAULT 4 NOT NULL
);
EOSQL

npm run db:migrate
```

After you **push** the repo fix, `npm run db:ensure-facilities-base` is the supported equivalent.

**Apache for masomobest.com (bishopcl docroot only):** as `bishopcl`, proxy to the same Node port (root’s PM2):

```bash
su - bishopcl
mkdir -p ~/public_html
cat > ~/public_html/.htaccess << 'EOF'
RewriteEngine On
RewriteBase /
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule ^(.*)$ http://127.0.0.1:5000/$1 [P,L]
EOF
```

Or copy from root after pull:  
`cp /root/school-os/deploy/cwp-public_html.htaccess /home/bishopcl/public_html/.htaccess`

CWP → domain **masomobest.com** → user **bishopcl** → docroot `/home/bishopcl/public_html`.  
Enable **ProxyPass** in the vhost if `[P]` in `.htaccess` fails (CWP often has no `/etc/httpd/conf.modules.d/00-proxy.conf`).

**Later (optional):** move the app to `/home/bishopcl/school-os` and run PM2 as `bishopcl`. Until then, only `public_html` needs `bishopcl`.

---

## Part A — CWP panel (do this first)

1. Log in to **CentOS Web Panel** as admin.
2. **DNS Zones** (or your registrar):
   - `masomobest.com` → **A** record → your server IP (same IP as today if same box).
   - Optional: `www` → **A** or **CNAME** to `masomobest.com`.
3. **User Accounts** → user **bishopcl**:
   - Add **masomobest.com** as the primary domain **or** addon domain.
   - Document root must be: `/home/bishopcl/public_html`
4. **AutoSSL** → issue certificate for `masomobest.com` and `www.masomobest.com`.
5. (Optional) Keep `school.bclimaxtech.com` as a redirect later (see Part F).

Wait until DNS propagates (often 5–60 minutes). Check:

```bash
dig +short masomobest.com
```

---

## Part B — SSH: connect

From your Mac/PC:

```bash
ssh bishopcl@YOUR_SERVER_IP
```

If login fails (`account is currently not available`), as **root** once:

```bash
usermod -s /bin/bash bishopcl
passwd bishopcl   # set password if needed
```

Then SSH again as `bishopcl`.

---

## Part C — Same server: switch domain (fast path)

Use this if `/home/bishopcl/school-os` already exists and PM2 already runs.  
If the app is only under **`/root/school-os`**, use the **root** block in [Your VPS today](#your-vps-today-rootschool-os--read-this-first) instead.

### 1. Update environment

```bash
cd ~/school-os
nano server/.env
```

Set (adjust password/DB if yours differ):

```env
NODE_ENV=production
PORT=5000
DATABASE_URL=postgres://schoolos:YOUR_DB_PASSWORD@127.0.0.1:5432/school_os
SESSION_SECRET=keep-your-existing-secret-do-not-change-randomly
CLIENT_ORIGIN=https://masomobest.com
PLATFORM_DOMAIN=masomobest.com
INGRESS_CNAME_TARGET=masomobest.com
```

Save (`Ctrl+O`, Enter, `Ctrl+X`).

### 2. Pull latest code, repair DB, rebuild

```bash
cd ~/school-os
git pull origin main
npm install
npm install --prefix server
npm install --prefix client
npm run build
npm run db:repair --prefix server
npm run db:migrate
```

### 3. Restart app

```bash
pm2 restart school-os --update-env
pm2 save
```

### 4. Health check (on server)

```bash
curl -s http://127.0.0.1:5000/api/health
curl -sI http://127.0.0.1:5000/ | head -5
```

You should see JSON from `/api/health` and `200` for `/`.

### 5. Install Apache proxy in `public_html`

```bash
cat > ~/public_html/.htaccess << 'EOF'
RewriteEngine On
RewriteBase /

RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule ^(.*)$ http://127.0.0.1:5000/$1 [P,L]
EOF
```

### 6. Enable Apache proxy (as root, one time)

SSH as root (second terminal) or `su -`:

```bash
# Enable proxy modules (CentOS / CWP)
grep -q 'proxy_module' /etc/httpd/conf.modules.d/00-proxy.conf 2>/dev/null || \
  echo 'LoadModule proxy_module modules/mod_proxy.so' >> /etc/httpd/conf.modules.d/00-proxy.conf
grep -q 'proxy_http_module' /etc/httpd/conf.modules.d/00-proxy.conf 2>/dev/null || \
  echo 'LoadModule proxy_http_module modules/mod_proxy_http.so' >> /etc/httpd/conf.modules.d/00-proxy.conf

systemctl restart httpd
```

If `[P]` still fails, in CWP → **Apache Settings** → vhost for `masomobest.com` → add:

```apache
ProxyPreserveHost On
ProxyPass / http://127.0.0.1:5000/
ProxyPassReverse / http://127.0.0.1:5000/
```

### 7. Browser test

| URL | Purpose |
|-----|---------|
| https://masomobest.com/ | Marketing home |
| https://masomobest.com/s/school-a/login | School staff login |
| https://masomobest.com/platform/login | Platform admin |

---

## Part D — Fresh install on this server (no app yet)

As **bishopcl**:

```bash
# Node 20 + PM2
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
source ~/.bashrc
nvm install 20
nvm use 20
npm install -g pm2

# Clone
cd ~
git clone https://github.com/drcwiseman/school-os.git
cd school-os
npm install
npm install --prefix server
npm install --prefix client

cp server/.env.example server/.env
nano server/.env
```

Minimum `server/.env`:

```env
NODE_ENV=production
PORT=5000
DATABASE_URL=postgres://schoolos:YOUR_PASSWORD@127.0.0.1:5432/school_os
SESSION_SECRET=PASTE_OUTPUT_OF_openssl_rand_hex_32
CLIENT_ORIGIN=https://masomobest.com
PLATFORM_DOMAIN=masomobest.com
```

PostgreSQL (as **root**, if not installed):

```bash
yum install -y postgresql-server postgresql postgresql-contrib
postgresql-setup initdb
systemctl enable postgresql --now
sudo -u postgres psql -c "CREATE USER schoolos WITH PASSWORD 'YOUR_PASSWORD';"
sudo -u postgres psql -c "CREATE DATABASE school_os OWNER schoolos;"
PGPASSWORD=YOUR_PASSWORD psql -h 127.0.0.1 -U schoolos -d school_os -c "CREATE EXTENSION IF NOT EXISTS pgcrypto;"
```

Then as **bishopcl**:

```bash
cd ~/school-os
openssl rand -hex 32
npm run build
npm run db:repair --prefix server
npm run db:migrate
npm run db:seed    # optional demo schools; skip in production

APP_DOMAIN=masomobest.com ./scripts/deploy-cwp-bishopcl.sh
```

---

## Part E — Migrate database from old VPS (only if DB was on another machine)

On **old server**:

```bash
pg_dump -h 127.0.0.1 -U schoolos -Fc school_os > school_os.dump
```

Copy to new server:

```bash
scp school_os.dump bishopcl@NEW_IP:~/
```

On **new server** (as root or postgres):

```bash
PGPASSWORD=YOUR_PASSWORD pg_restore -h 127.0.0.1 -U schoolos -d school_os --clean --if-exists ~/school_os.dump
```

Then run repair + restart:

```bash
cd ~/school-os
git pull origin main
npm run db:repair --prefix server
npm run db:migrate
pm2 restart school-os --update-env
```

Also copy uploads if you use local files:

```bash
rsync -avz OLD_SERVER:/home/bishopcl/school-os/server/uploads/ ~/school-os/server/uploads/
```

---

## Part F — bclimax vs masomobest (do not mix)

- **bclimax** — separate site; leave its PM2 app, database, and CWP vhost **unchanged**.
- **masomobest.com** — School OS only; docroot `/home/bishopcl/public_html` → proxy port **5000** → PM2 `school-os`.

Do **not** point bclimax domains at the School OS port unless you intend to replace that site. Optional: redirect an old **School OS** URL (e.g. `school.bclimaxtech.com`) to `https://masomobest.com` in CWP without editing the **bclimax** app.

---

## Routine updates (after migration)

```bash
ssh bishopcl@YOUR_SERVER_IP
cd ~/school-os
git pull origin main
npm run build
npm run db:repair --prefix server
pm2 restart school-os --update-env
```

One-liner with deploy script:

```bash
cd ~/school-os && git pull origin main && APP_DOMAIN=masomobest.com ./scripts/deploy-cwp-bishopcl.sh
```

---

## Troubleshooting

| Symptom | What to do |
|---------|------------|
| **Empty `pm2 list` as bishopcl** | Normal. bclimax is on **root** PM2: `su -` → `pm2 list`. Do not run reset as bishopcl. |
| **`cd /root/school-os` Permission denied** | Use root for `/root`, or install under `~/school-os` as bishopcl |
| **Site can’t be reached / ERR_FAILED** | `dig +short masomobest.com A` → must be `173.231.241.161`; CWP domain on **bishopcl** + AutoSSL; `curl -v http://127.0.0.1:5000/api/health`; `~/public_html/.htaccess` proxy |
| **502 / 503 Bad Gateway** | `cd ~/school-os/server && ./scripts/pm2-start.sh`; `pm2 logs school-os --lines 80` |
| **`Fix server/.env` / Connection refused after `pm2 restart`** | Do **not** `pm2 restart` — run `./scripts/pm2-start.sh` (reads `.env` via `ecosystem.config.cjs`) |
| **`curl` health empty but PM2 online** | `pm2 logs school-os`; port clash: `ss -tlnp \| grep 5000`; rebuild client: `npm install --prefix client && npm run build` |
| **`.htaccess: Permission denied`** | As root: `chown -R bishopcl:bishopcl /home/bishopcl/public_html` or set **ProxyPass** in CWP vhost |
| **`EMFILE` / client build fails** | As root: `ulimit -n 65535` and limits.conf; then `su - bishopcl` → `npm run build` |
| **`sw.js` / Failed to fetch in Chrome** | Old cached service worker; Incognito → Application → Service Workers → Unregister; clear site data |
| **`ERR_CONNECTION_CLOSED` / site can't be reached** | Browser uses **https://** but nginx may only have **:80** for masomobest; try **http://masomobest.com** first; enable **CWP AutoSSL**; open firewall **80/443** |
| **`curl` on server = 200 but browser fails** | Test from your Mac: `curl -sI http://masomobest.com/`; server curl uses IP+Host header, browser uses public DNS + HTTPS |
| **`client/dist not found` in pm2 logs** | Run `npm run build` successfully (fix EMFILE first) then `./scripts/pm2-start.sh` |
| **Cannot GET /s/...** | Run `npm run build`; confirm `.htaccess` proxies to port 5000 |
| **CORS / login fails** | `CLIENT_ORIGIN` must be exactly `https://masomobest.com` (no trailing slash) |
| **White screen** | Browser DevTools → Network; rebuild client; hard refresh |
| **DB errors** | `systemctl status postgresql`; check `DATABASE_URL`; `npm run db:repair --prefix server` |
| **`db:migrate` fails at 0022 (`transport_vehicles` does not exist)** | `git pull`; `npm run db:repair`; then `npm run db:migrate` (0022 now creates transport/library/boarding base tables first) |
| **Repair warns `library_books` / `library_loans` missing** | Same as above — run repair after pull so patch creates those tables before later SQL files |
| **Apache [P] failed** | Enable `mod_proxy` + `mod_proxy_http`; use vhost `ProxyPass` block |
| **`.htaccess` under `/root/public_html`** | Deploy as user **bishopcl**: `/home/bishopcl/public_html/.htaccess`, app in `/home/bishopcl/school-os` |

Logs:

```bash
pm2 logs school-os
tail -f /usr/local/apache/logs/error_log
```

---

## Checklist

- [ ] `pm2 list` shows **bclimax** `online` after reset (never deleted)
- [ ] DNS A record for `masomobest.com` → server IP
- [ ] CWP: domain on user `bishopcl`, docroot `/home/bishopcl/public_html`
- [ ] SSL active on `masomobest.com`
- [ ] App in `/home/bishopcl/school-os`, **not** inside `public_html`
- [ ] `server/.env`: `CLIENT_ORIGIN=https://masomobest.com`
- [ ] `npm run build` + `cd server && ./scripts/pm2-start.sh`
- [ ] `~/public_html/.htaccess` proxies to `127.0.0.1:5000`
- [ ] `curl http://127.0.0.1:5000/api/health` OK
- [ ] Browser: login at `/s/school-a/login` works
