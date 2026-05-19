# Deploy School OS on InMotion (SSH / VPS)

School OS needs **Node.js 20+**, **PostgreSQL**, and a **long-running process** (PM2). That works on **InMotion VPS** or **Dedicated** with root/SSH. It does **not** work on typical **shared hosting** (no persistent Node + no Postgres).

## Before you start — check your plan

SSH in and run:

```bash
uname -a
node -v          # need v20+
psql --version   # need PostgreSQL 14+
which pm2 nginx
```

| Plan type | Can host School OS? |
|-----------|---------------------|
| **VPS / Dedicated** | Yes — follow this guide |
| **Shared (cPanel only)** | Usually **no** — upgrade to VPS or use Railway/Render instead |

---

## 1. One-time server setup (VPS)

Run as a user with `sudo` (replace `deploy` with your Linux user).

```bash
# Node 20 via nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
source ~/.bashrc
nvm install 20
nvm use 20

# PM2
npm install -g pm2

# PostgreSQL (Ubuntu/Debian)
sudo apt update
sudo apt install -y postgresql postgresql-contrib nginx git build-essential

sudo -u postgres psql -c "CREATE USER schoolos WITH PASSWORD 'CHANGE_ME_STRONG';"
sudo -u postgres psql -c "CREATE DATABASE school_os OWNER schoolos;"
```

---

## 2. Deploy the app

```bash
cd ~
git clone https://github.com/drcwiseman/school-os.git
cd school-os

# Environment
cp server/.env.example server/.env
nano server/.env
```

Set at minimum:

```env
NODE_ENV=production
PORT=5000
DATABASE_URL=postgres://schoolos:CHANGE_ME_STRONG@localhost:5432/school_os
SESSION_SECRET=PASTE_64_CHAR_RANDOM_HEX
CLIENT_ORIGIN=https://your-domain.com
```

Build and migrate:

```bash
npm install
npm install --prefix server
npm install --prefix client
npm run build
npm run db:migrate
npm run db:seed    # optional demo schools; skip in real production
```

Start with PM2:

```bash
cd server
pm2 start dist/index.js --name school-os
pm2 save
pm2 startup   # run the command it prints so app survives reboot
```

The API serves the built React app on the same port in production (`NODE_ENV=production`).

---

## CentOS WebPanel (CWP) note

CWP uses **Apache** on port 80 by default. A Node app on port 5000 is **not** reachable at `http://your-ip/school-a/login` until you add a **reverse proxy**.

In CWP → **Apache Settings** → include a proxy to Node, or add to your vhost:

```apache
ProxyPreserveHost On
ProxyPass / http://127.0.0.1:5000/
ProxyPassReverse / http://127.0.0.1:5000/
```

Requirements on the VPS:

```bash
cd ~/school-os
npm run build
export NODE_ENV=production
pm2 start server/dist/index.js --name school-os
```

Then open `http://YOUR_IP/` (not `:5000` unless that port is open in the firewall).

**"Cannot GET /s/school-a/login"** means the browser hit the API without the React app — run `npm run build` and ensure Apache proxies to Node, or use port 5000 with the built `client/dist` present.

---

## 3. Nginx reverse proxy (HTTPS)

Create `/etc/nginx/sites-available/school-os` (sudo):

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/school-os /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

Use **AutoSSL in WHM/cPanel** or **Certbot** for HTTPS, then set `CLIENT_ORIGIN=https://your-domain.com`.

---

## 4. Firewall

InMotion VPS often has CSF. Allow HTTP/HTTPS and block public access to port 5000:

```bash
# Only localhost should hit Node; Nginx is the public entry
sudo ufw allow 80,443/tcp
```

---

## 5. Updates (redeploy)

```bash
cd ~/school-os
git pull
npm run build
npm run db:migrate
pm2 restart school-os
```

---

## 6. Automated script

From the repo on the server:

```bash
chmod +x scripts/deploy-inmotion.sh
APP_DOMAIN=your-domain.com ./scripts/deploy-inmotion.sh
```

---

## Can Cursor deploy for you?

The assistant **cannot** log into your InMotion account by itself. You can:

1. SSH from your machine: `ssh user@your-server.inmotionhosting.com`
2. Paste the commands above, or run `scripts/deploy-inmotion.sh`
3. Share any errors from the terminal for troubleshooting

If you use **InMotion managed VPS**, ask support to confirm: Node 20, PostgreSQL, and permission to run PM2 on port 5000 behind Nginx.

---

## URLs after deploy

| Audience | URL |
|----------|-----|
| Home | `https://your-domain.com/` |
| Staff | `https://your-domain.com/s/school-a/login` |
| Portal | `https://your-domain.com/s/school-a/portal/login` |
| Platform | `https://your-domain.com/platform/login` |

Default demo logins exist only if you ran `db:seed` — change passwords immediately in production.
