#!/usr/bin/env bash
# Deploy Maxwell to production (nginx + systemd). See docs/DEPLOY.md.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WEB_ROOT="${WEB_ROOT:-/var/www/maxwell}"
API_SERVICE="${API_SERVICE:-maxwell-api}"

cd "$REPO_ROOT"
echo "==> install"
npm install

echo "==> build (API + web with VITE_API_BASE_URL=/api)"
npm run build:prod

echo "==> copy web to nginx root: $WEB_ROOT"
sudo mkdir -p "$WEB_ROOT"
sudo rsync -a --delete "$REPO_ROOT/apps/web/dist/" "$WEB_ROOT/"
sudo chown -R www-data:www-data "$WEB_ROOT" 2>/dev/null || true

echo "==> restart API + nginx"
sudo systemctl restart "$API_SERVICE"
sudo systemctl reload nginx

echo "==> smoke"
curl -fsS http://127.0.0.1:3001/health && echo ""
echo "OK. Test: curl -fsS https://maxwell.rovark.in/api/health"
