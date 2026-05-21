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

## Overview

```text
Browser → https://masomobest.com
       → Apache (public_html/.htaccess)
       → http://127.0.0.1:5000 (PM2: school-os)
       → PostgreSQL (school_os database)
```

If you already run on `school.bclimaxtech.com` on the **same server**, you mostly change **DNS + CWP domain + `.env` + restart PM2**. The database and uploads stay in place.

---

## Your VPS today (`/root/school-os`) — read this first

On **vps138679** the live app is under **root**, not `bishopcl`:

| What | Actual path / user |
|------|---------------------|
| App + git + PM2 (`school-os`) | **`/root/school-os`** (SSH as **root**) |
| `bishopcl` home | `/home/bishopcl` — **no** `school-os` clone yet |
| `curl :5000/api/health` | Works from root’s PM2 |

**Do not** run `git pull` / `npm run db:*` as `bishopcl` until you clone the app there. For now, fix DB and deploy **as root**:

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

## Part F — Redirect old domain (optional)

In CWP, for `school.bclimaxtech.com` vhost, add redirect to `https://masomobest.com` or keep both pointing at the same `public_html` + PM2 (both domains work until you remove DNS).

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
| **502 Bad Gateway** | `pm2 status` → start/restart `school-os`; `pm2 logs school-os --lines 80` |
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

- [ ] DNS A record for `masomobest.com` → server IP
- [ ] CWP: domain on user `bishopcl`, docroot `/home/bishopcl/public_html`
- [ ] SSL active on `masomobest.com`
- [ ] App in `/home/bishopcl/school-os`, **not** inside `public_html`
- [ ] `server/.env`: `CLIENT_ORIGIN=https://masomobest.com`
- [ ] `npm run build` + `pm2 restart school-os --update-env`
- [ ] `~/public_html/.htaccess` proxies to `127.0.0.1:5000`
- [ ] `curl http://127.0.0.1:5000/api/health` OK
- [ ] Browser: login at `/s/school-a/login` works
