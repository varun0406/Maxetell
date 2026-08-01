# Deploy Maxwell Trading → maxwell.rovark.in

Nginx serves the web app and proxies `/api/` → Fastify on `127.0.0.1:3002`.

> **Port note:** `3001` is used by **jigness** on this host. Maxwell must use **3002**.

## One-time server setup

### 0. DNS

Point `maxwell.rovark.in` A record to your server IP.

### 1. Node.js 20+ (on the server)

```bash
node -v   # should be v20+ (v22 ok)
# if missing: install via nvm or nodesource
```

### 2. Clone & install

```bash
sudo mkdir -p /var/www/maxwell /var/lib/maxwell /etc/maxwell
sudo chown -R "$USER":"$USER" /var/www/maxwell /var/lib/maxwell

cd /opt
sudo git clone https://github.com/varun0406/Maxetell.git maxwell
sudo chown -R "$USER":"$USER" /opt/maxwell
cd /opt/maxwell

npm install
```

### 3. API env (port 3002)

```bash
sudo mkdir -p /etc/maxwell /var/lib/maxwell /var/www/maxwell
sudo chown -R "$USER":"$USER" /var/lib/maxwell /var/www/maxwell

SECRET=$(openssl rand -hex 32)
sudo tee /etc/maxwell/api.env >/dev/null <<EOF
PORT=3002
HOST=127.0.0.1
CORS_ORIGIN=https://maxwell.rovark.in
DB_PATH=/var/lib/maxwell/maxwell.sqlite
LOG_LEVEL=info
AUTH_SECRET=$SECRET
EOF

sudo chmod 644 /etc/maxwell/api.env
```

`AUTH_SECRET` enables login. First visit → create first admin on `/login`.

### 4. systemd service

```bash
sudo tee /etc/systemd/system/maxwell-api.service >/dev/null <<'EOF'
[Unit]
Description=Maxwell Trading API
After=network.target

[Service]
Type=simple
WorkingDirectory=/opt/maxwell/apps/api
EnvironmentFile=/etc/maxwell/api.env
Environment=NODE_ENV=production
ExecStart=/usr/bin/node dist/index.js
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
EOF
```

If your clone is not `/opt/maxwell`, change `WorkingDirectory`.

```bash
cd /opt/maxwell
npm run build:prod

sudo rsync -a --delete apps/web/dist/ /var/www/maxwell/

# wipe only Maxwell DB (never touch jigness)
sudo rm -f /var/lib/maxwell/maxwell.sqlite /var/lib/maxwell/maxwell.sqlite-*

sudo systemctl daemon-reload
sudo systemctl enable --now maxwell-api
sudo systemctl status maxwell-api --no-pager
curl -s http://127.0.0.1:3002/auth/status; echo
# expect: {"enabled":true,"can_bootstrap":true,"has_db_users":false}
```

### 5. nginx site

```bash
sudo cp /opt/maxwell/docs/nginx.maxwell.rovark.in.conf /etc/nginx/sites-available/maxwell
# or tee from docs — must proxy to 127.0.0.1:3002

sudo ln -sf /etc/nginx/sites-available/maxwell /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

### 6. HTTPS (Let's Encrypt)

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d maxwell.rovark.in
```

### 7. Smoke tests

```bash
curl -s http://127.0.0.1:3002/health
curl -s https://maxwell.rovark.in/api/health
# open https://maxwell.rovark.in → create first admin
```

### Quick fix if Maxwell was pointed at 3001

From `/opt/maxwell` as root:

```bash
sudo bash scripts/fix-port-3002.sh
sudo certbot --nginx -d maxwell.rovark.in   # if SSL not done yet
```

---

## Every later deploy

From `/opt/maxwell` (or use `./scripts/deploy.sh`):

```bash
cd /opt/maxwell
git pull
npm install
npm run build:prod
sudo rsync -a --delete apps/web/dist/ /var/www/maxwell/
sudo systemctl restart maxwell-api
sudo systemctl reload nginx
```

---

## Capacitor app pointing at production

```bash
cd apps/web
VITE_API_BASE_URL=https://maxwell.rovark.in/api npm run build
npx cap sync android
```

---

## Demo data on server (optional)

```bash
curl -X POST https://maxwell.rovark.in/api/mx/demo/reseed
```

Or from Device & Sync → **Load demo data** after login.
