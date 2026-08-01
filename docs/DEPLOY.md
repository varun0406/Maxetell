# Deploy Maxwell Trading → maxwell.rovark.in

Nginx serves the web app and proxies `/api/` → Fastify on `127.0.0.1:3001`.

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

# pick a path you like, e.g.:
cd /opt
sudo git clone https://github.com/varun0406/Maxetell.git maxwell
sudo chown -R "$USER":"$USER" /opt/maxwell
cd /opt/maxwell

npm install
```

### 3. API env

```bash
# generate a secret:
openssl rand -hex 32

sudo tee /etc/maxwell/api.env >/dev/null <<'EOF'
PORT=3001
HOST=127.0.0.1
CORS_ORIGIN=https://maxwell.rovark.in
DB_PATH=/var/lib/maxwell/maxwell.sqlite
LOG_LEVEL=info
AUTH_SECRET=PASTE_THE_HEX_SECRET_HERE
EOF

sudo chmod 600 /etc/maxwell/api.env
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
WorkingDirectory=/opt/maxwell
EnvironmentFile=/etc/maxwell/api.env
ExecStart=/usr/bin/npm run start -w @maxwell/api
Restart=always
RestartSec=3
User=www-data
Group=www-data

# SQLite needs write access for the service user
ReadWritePaths=/var/lib/maxwell

[Install]
WantedBy=multi-user.target
EOF
```

If your clone is not `/opt/maxwell`, change `WorkingDirectory`.

```bash
# let www-data own the DB dir + built API can read the repo
sudo chown -R www-data:www-data /var/lib/maxwell
sudo chown -R "$USER":www-data /opt/maxwell
sudo chmod -R g+rX /opt/maxwell

# build once before starting
cd /opt/maxwell
npm run build:prod

sudo mkdir -p /var/www/maxwell
sudo rsync -a --delete apps/web/dist/ /var/www/maxwell/
sudo chown -R www-data:www-data /var/www/maxwell

sudo systemctl daemon-reload
sudo systemctl enable --now maxwell-api
sudo systemctl status maxwell-api --no-pager
```

If `User=www-data` cannot run npm from your home/nvm path, either:

- install Node system-wide (`/usr/bin/node`), or  
- set `User=` to the user that owns `/opt/maxwell` and chown `/var/lib/maxwell` to that user.

### 5. nginx site

```bash
sudo tee /etc/nginx/sites-available/maxwell.rovark.in >/dev/null <<'EOF'
server {
    listen 80;
    listen [::]:80;
    server_name maxwell.rovark.in;

    root /var/www/maxwell;
    index index.html;

    # API → Fastify (strip /api prefix)
    location /api/ {
        proxy_pass http://127.0.0.1:3001/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # SPA routes (React Router)
    location / {
        try_files $uri $uri/ /index.html;
    }
}
EOF

sudo ln -sf /etc/nginx/sites-available/maxwell.rovark.in /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

### 6. HTTPS (Let's Encrypt)

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d maxwell.rovark.in
```

Certbot will adjust the nginx file for 443.

### 7. Smoke tests

```bash
curl -s http://127.0.0.1:3001/health
curl -s https://maxwell.rovark.in/api/health
# open https://maxwell.rovark.in → create first admin
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
sudo chown -R www-data:www-data /var/www/maxwell
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

With API running and auth token, or temporarily without auth if `AUTH_SECRET` unset:

```bash
curl -X POST https://maxwell.rovark.in/api/mx/demo/reseed
```

Or from Device & Sync → **Load demo data** after login.
