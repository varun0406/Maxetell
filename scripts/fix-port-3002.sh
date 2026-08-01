#!/usr/bin/env bash
# One-shot: move Maxwell API to port 3002 (leave jigness on 3001).
# Run on the server as root:
#   cd /opt/maxwell && sudo bash scripts/fix-port-3002.sh
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
API_PORT=3002
OPT_API="/opt/maxwell/apps/api"

echo "==> dirs"
mkdir -p /etc/maxwell /var/lib/maxwell /var/www/maxwell

echo "==> api.env (PORT=${API_PORT})"
if [[ -f /etc/maxwell/api.env ]] && grep -qE '^AUTH_SECRET=.+' /etc/maxwell/api.env; then
  SECRET=$(grep -E '^AUTH_SECRET=' /etc/maxwell/api.env | head -1 | cut -d= -f2-)
else
  SECRET=$(openssl rand -hex 32)
fi
tee /etc/maxwell/api.env >/dev/null <<EOF
PORT=${API_PORT}
HOST=127.0.0.1
CORS_ORIGIN=https://maxwell.rovark.in
DB_PATH=/var/lib/maxwell/maxwell.sqlite
LOG_LEVEL=info
AUTH_SECRET=${SECRET}
EOF
chmod 644 /etc/maxwell/api.env
cat /etc/maxwell/api.env | sed 's/AUTH_SECRET=.*/AUTH_SECRET=***/'

echo "==> systemd unit (node dist @ ${OPT_API})"
tee /etc/systemd/system/maxwell-api.service >/dev/null <<EOF
[Unit]
Description=Maxwell Trading API
After=network.target

[Service]
Type=simple
WorkingDirectory=${OPT_API}
EnvironmentFile=/etc/maxwell/api.env
Environment=NODE_ENV=production
ExecStart=/usr/bin/node dist/index.js
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
EOF

echo "==> wipe Maxwell SQLite only (not jigness)"
rm -f /var/lib/maxwell/maxwell.sqlite /var/lib/maxwell/maxwell.sqlite-*
rm -f /opt/maxwell/apps/api/data/*.sqlite /opt/maxwell/apps/api/data/*.sqlite-* 2>/dev/null || true

echo "==> build API + web"
cd "$REPO_ROOT"
npm run build:prod
rsync -a --delete "$REPO_ROOT/apps/web/dist/" /var/www/maxwell/

echo "==> nginx → :${API_PORT} (preserve certbot SSL if present)"
NGINX_CANDIDATES=(
  /etc/nginx/sites-available/maxwell
  /etc/nginx/sites-available/maxwell.rovark.in
)
UPDATED=0
for f in "${NGINX_CANDIDATES[@]}"; do
  if [[ -f "$f" ]]; then
    sed -i -E 's|127\.0\.0\.1:3001|127.0.0.1:'"${API_PORT}"'|g' "$f"
    echo "    updated proxy in $f"
    UPDATED=1
  fi
done

if [[ "$UPDATED" -eq 0 ]]; then
  tee /etc/nginx/sites-available/maxwell >/dev/null <<EOF
server {
    listen 80;
    listen [::]:80;
    server_name maxwell.rovark.in;

    root /var/www/maxwell;
    index index.html;
    client_max_body_size 20m;

    location /api/ {
        proxy_pass http://127.0.0.1:${API_PORT}/;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 120s;
    }

    location / {
        try_files \$uri \$uri/ /index.html;
    }
}
EOF
  ln -sf /etc/nginx/sites-available/maxwell /etc/nginx/sites-enabled/maxwell
  echo "    created /etc/nginx/sites-available/maxwell"
else
  # ensure at least one is enabled
  if [[ -f /etc/nginx/sites-available/maxwell ]]; then
    ln -sf /etc/nginx/sites-available/maxwell /etc/nginx/sites-enabled/maxwell
  elif [[ -f /etc/nginx/sites-available/maxwell.rovark.in ]]; then
    ln -sf /etc/nginx/sites-available/maxwell.rovark.in /etc/nginx/sites-enabled/maxwell.rovark.in
  fi
fi

nginx -t
systemctl reload nginx

echo "==> start maxwell-api (do not touch jigness :3001)"
systemctl daemon-reload
systemctl enable maxwell-api
systemctl restart maxwell-api
sleep 2
systemctl --no-pager --full status maxwell-api || true

echo "==> verify"
ss -lptn "sport = :${API_PORT}" || true
echo -n "auth/status: "
curl -s "http://127.0.0.1:${API_PORT}/auth/status" || echo FAIL
echo
echo -n "health: "
curl -s "http://127.0.0.1:${API_PORT}/health" || echo FAIL
echo
echo
echo "Done. Expect {\"enabled\":true,\"can_bootstrap\":true,\"has_db_users\":false}"
echo "Then: https://maxwell.rovark.in/login → create first admin"
echo "If no SSL yet: sudo certbot --nginx -d maxwell.rovark.in"
