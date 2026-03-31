#!/usr/bin/env bash
# Edwin Slides Creator -- Build & Deploy to Azure
# Usage: ./deploy.sh [--skip-build] [--skip-deploy]
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
SUBSCRIPTION="pzi-gxx1-sw5t3-dev001"
RESOURCE_GROUP="rg-edwin-slides"
APP_NAME="app-edwin-slides"

SKIP_BUILD=false
SKIP_DEPLOY=false

for arg in "$@"; do
  case "$arg" in
    --skip-build)  SKIP_BUILD=true ;;
    --skip-deploy) SKIP_DEPLOY=true ;;
    *) echo "Unknown argument: $arg"; exit 1 ;;
  esac
done

echo "=== Edwin Slides Creator - Build & Deploy ==="

if [ "$SKIP_BUILD" = false ]; then
  # Step 1: Build frontend
  echo ""
  echo "[1/4] Building frontend..."
  cd "$ROOT/slide-generator"
  npm run build
  cd "$ROOT"

  # Step 2: Compile backend TypeScript
  echo ""
  echo "[2/4] Compiling backend..."
  cd "$ROOT/backend"
  npm run build
  cd "$ROOT"

  # Step 3: Copy frontend build into backend/public
  echo ""
  echo "[3/4] Copying frontend assets to backend/public..."
  rm -rf "$ROOT/backend/public"
  cp -r "$ROOT/slide-generator/dist" "$ROOT/backend/public"

  # Step 4: Create deployment zip
  echo ""
  echo "[4/4] Creating deployment package..."
  DEPLOY_TEMP="$ROOT/deploy-temp"
  ZIP_PATH="$ROOT/edwin-slides.zip"

  rm -rf "$DEPLOY_TEMP" "$ZIP_PATH"
  mkdir -p "$DEPLOY_TEMP"

  cp -r "$ROOT/backend/dist" "$DEPLOY_TEMP/dist"
  cp -r "$ROOT/backend/public" "$DEPLOY_TEMP/public"
  [ -d "$ROOT/backend/assets" ] && cp -r "$ROOT/backend/assets" "$DEPLOY_TEMP/assets" || true
  cp "$ROOT/backend/package.json" "$DEPLOY_TEMP/package.json"
  cp "$ROOT/backend/package-lock.json" "$DEPLOY_TEMP/package-lock.json" 2>/dev/null || true

  cd "$DEPLOY_TEMP"
  npm install --omit=dev
  cd "$ROOT"

  (cd "$DEPLOY_TEMP" && zip -rq "$ZIP_PATH" .)
  rm -rf "$DEPLOY_TEMP"

  ZIP_SIZE=$(du -h "$ZIP_PATH" | cut -f1)
  echo "Deployment package created: $ZIP_PATH ($ZIP_SIZE)"
fi

if [ "$SKIP_DEPLOY" = false ]; then
  ZIP_PATH="$ROOT/edwin-slides.zip"
  if [ ! -f "$ZIP_PATH" ]; then
    echo "Error: Deployment package not found at $ZIP_PATH. Run without --skip-build first."
    exit 1
  fi

  echo ""
  echo "Setting Azure subscription: $SUBSCRIPTION"
  az account set --subscription "$SUBSCRIPTION"

  echo "Deploying to Azure App Service: $APP_NAME..."
  az webapp deploy \
    --resource-group "$RESOURCE_GROUP" \
    --name "$APP_NAME" \
    --src-path "$ZIP_PATH" \
    --type zip \
    --restart true

  echo ""
  echo "Deployment complete!"
  echo "URL: https://$APP_NAME.azurewebsites.net/"
fi
