#!/bin/bash

# Exit immediately if a command exits with a non-zero status
set -e

# Change to the project root directory
cd "$(dirname "$0")/.."

echo "🚀 Starting Deployment..."

# 1. Pull the latest code from git
echo "📥 Pulling latest code..."
git pull

# 2. Build the API and Web apps
echo "🔨 Building API and Web..."
npm run build:prod

# 3. Copy API files to the production directory
echo "📂 Copying API dist files to /opt/maxwell/apps/api/dist/..."
sudo cp -r apps/api/dist/* /opt/maxwell/apps/api/dist/

# 4. Copy Web files to nginx production directory
echo "📂 Copying Web dist files to /var/www/maxwell..."
sudo mkdir -p /var/www/maxwell
sudo rsync -a --delete apps/web/dist/ /var/www/maxwell/
sudo chown -R www-data:www-data /var/www/maxwell 2>/dev/null || true

# 5. Restart the Systemd service and nginx
echo "🔄 Restarting maxwell-api service and nginx..."
sudo systemctl restart maxwell-api
sudo systemctl reload nginx

echo "✅ Deployment complete! API and Web are running the latest code."
