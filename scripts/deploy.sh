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
npm run build -w @maxwell/api
npm run build -w @maxwell/web

# 3. Copy API files to the production directory
echo "📂 Copying API dist files to /opt/maxwell/apps/api/dist/..."
sudo cp -r apps/api/dist/* /opt/maxwell/apps/api/dist/

# 4. Copy Web files to the production directory (if it exists)
echo "📂 Copying Web dist files to /opt/maxwell/apps/web/dist/..."
sudo cp -r apps/web/dist/* /opt/maxwell/apps/web/dist/ || echo "Web dist folder not found in /opt/maxwell, skipping..."

# 5. Restart the Systemd service
echo "🔄 Restarting maxwell-api service..."
sudo systemctl restart maxwell-api

echo "✅ Deployment complete! API is running the latest code."
