#!/bin/bash
# Deploy React site + admin tools to hermes-web
set -euo pipefail

export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"

cd "$(dirname "$0")/.."

echo "=== Pulling latest code ==="
git pull origin main

echo "=== Building site ==="
npm install
npm run build

echo "=== Deploying to hermes-web/www ==="
rsync -a --delete dist/ ~/hermes-web/www/

echo "=== Deploying photo admin tool ==="
mkdir -p ~/hermes-web/www/photos-admin
cp tools/photos-manager.html ~/hermes-web/www/photos-admin/index.html

echo "=== Done ==="
