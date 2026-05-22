# Deploy School OS on `school.bclimaxtech.com` (CWP / bishopcl)

> **Retired.** Production SchoolOS now runs at **[https://masomobest.com](https://masomobest.com)** — see **[CWP-MASMOBEST-MIGRATION.md](./CWP-MASMOBEST-MIGRATION.md)**. Do not use this subdomain for new installs; redirect `school.bclimaxtech.com` → `masomobest.com` in CWP if the old URL still resolves.

| Item | Value |
|------|--------|
| Subdomain | **school** → `https://school.bclimaxtech.com` |
| CWP user | `bishopcl` |
| Document root | `/home/bishopcl/public_html` |
| App code (recommended) | `/home/bishopcl/school-os` |
| Node port | `5000` (localhost only) |

Do **not** put the git repo inside `public_html`. Only a small `.htaccess` proxy lives there; the app runs from `school-os` via PM2.

---

## Step 1 — CWP panel (you may have done this)

1. **SubDomains** → create `school` for `bclimaxtech.com`
2. Assign user **bishopcl** → docroot `/home/bishopcl/public_html`
3. **AutoSSL** → issue certificate for `school.bclimaxtech.com`

---

## Step 2 — SSH as root: install PostgreSQL + tools (CentOS)

```bash
# PostgreSQL + contrib (pgcrypto for gen_random_uuid — required by migrations)
yum install -y postgresql-server postgresql postgresql-contrib
postgresql-setup initdb
systemctl enable postgresql
systemctl start postgresql

set +H
sudo -u postgres psql -c "CREATE USER schoolos WITH PASSWORD 'SchoolOsDb2026';"
sudo -u postgres psql -c "CREATE DATABASE school_os OWNER schoolos;"
```

**No `!` in the password** when typing in bash, or use `set +H` first.

Enable `pgcrypto` (run **before** `npm run db:migrate`):

```bash
PGPASSWORD=SchoolOsDb2026 psql -h 127.0.0.1 -U schoolos -d school_os -c "CREATE EXTENSION IF NOT EXISTS pgcrypto;"
```

Allow password auth (fixes `Ident authentication failed`):

```bash
sed -i 's/ident$/md5/g; s/peer$/md5/g' /var/lib/pgsql/data/pg_hba.conf
systemctl restart postgresql
```

> After changing `pg_hba` to md5, `sudo -u postgres psql` needs a postgres DB password. Use `schoolos` + `PGPASSWORD=...` as above, or install contrib and run migrations before switching auth if you prefer peer for admin.

---

## Step 3 — SSH as user bishopcl

```bash
su - bishopcl
```

If `su - bishopcl` says **account is currently not available**, unlock the shell (as root):

```bash
usermod -s /bin/bash bishopcl
```

You can deploy as **root** (as you did) or as **bishopcl** after unlock. The subdomain docroot is always **`/home/bishopcl/public_html`** — not `/root/public_html`.

### Install Node 20 + PM2

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
source ~/.bashrc
nvm install 20
nvm use 20
npm install -g pm2
```

### Clone and configure app

```bash
cd ~
git clone https://github.com/drcwiseman/school-os.git
cd school-os
npm install
npm install --prefix server
npm install --prefix client

cp server/.env.example server/.env
nano server/.env
```

Set:

```env
NODE_ENV=production
PORT=5000
DATABASE_URL=postgres://schoolos:PickAStrongPassword123!@127.0.0.1:5432/school_os
SESSION_SECRET=paste-output-of-openssl-rand-hex-32
CLIENT_ORIGIN=https://school.bclimaxtech.com
```

```bash
openssl rand -hex 32   # copy into SESSION_SECRET

npm run build
npm run db:migrate
npm run db:seed        # optional demo logins; remove in production later
```

### Start app with PM2

```bash
cd ~/school-os
pm2 start server/dist/index.js --name school-os
pm2 save
pm2 startup
# run the command PM2 prints (may need root once)
```

Check:

```bash
curl -s http://127.0.0.1:5000/api/health
```

---

## Step 4 — Proxy Apache: `public_html` → Node

As **bishopcl**:

```bash
cat > ~/public_html/.htaccess << 'EOF'
RewriteEngine On
RewriteBase /

# Proxy everything to the Node app (API + React SPA)
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule ^(.*)$ http://127.0.0.1:5000/$1 [P,L]

# If [P] fails (proxy module off), try without proxy flag — contact host to enable mod_proxy
EOF
```

**As root**, enable Apache proxy modules and restart:

```bash
# CWP often uses httpd
httpd -M 2>/dev/null | grep proxy || apachectl -M 2>/dev/null | grep proxy

# Enable (paths vary; on CWP/CentOS 7):
grep -q 'proxy_module' /etc/httpd/conf.modules.d/00-proxy.conf || echo 'LoadModule proxy_module modules/mod_proxy.so' >> /etc/httpd/conf.modules.d/00-proxy.conf
grep -q 'proxy_http_module' /etc/httpd/conf.modules.d/00-proxy.conf || echo 'LoadModule proxy_http_module modules/mod_proxy_http.so' >> /etc/httpd/conf.modules.d/00-proxy.conf

systemctl restart httpd
```

If `[P]` does not work, in CWP use **Apache Settings → Include Editor** for the vhost and add:

```apache
ProxyPreserveHost On
ProxyPass / http://127.0.0.1:5000/
ProxyPassReverse / http://127.0.0.1:5000/
```

---

## Step 5 — Test in browser

| URL | Purpose |
|-----|---------|
| https://school.bclimaxtech.com/ | Home |
| https://school.bclimaxtech.com/s/school-a/login | Staff (after seed) |
| https://school.bclimaxtech.com/platform/login | Platform admin |

Demo (if seeded): `admin@school-a.com` / `Password123!`

---

## Updates

```bash
su - bishopcl
cd ~/school-os
git pull
npm run build
npm run db:migrate
pm2 restart school-os
```

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| **Cannot GET /s/school-a/login** | `npm run build` not run, or Apache not proxying to port 5000 |
| **White screen** | Open browser DevTools → Network; check JS/CSS 404. Rebuild client. |
| **502 Bad Gateway** | PM2 not running: `pm2 status`, `pm2 logs school-os` |
| **DB connection error** | Check `DATABASE_URL`, PostgreSQL running: `systemctl status postgresql` |
| **`pgcrypto.control: No such file`** | `yum install -y postgresql-contrib` then `CREATE EXTENSION pgcrypto` again |
| **`gen_random_uuid() does not exist`** | Install contrib + enable extension (above), then `npm run db:migrate` |

Logs:

```bash
pm2 logs school-os
tail -f /usr/local/apache/logs/error_log
```
