# Edwin Slides Creator -- Build & Deploy to Azure
# Usage: .\deploy.ps1 [-SkipBuild] [-SkipDeploy]
param(
    [switch]$SkipBuild,
    [switch]$SkipDeploy
)

$ErrorActionPreference = "Stop"
$ROOT = $PSScriptRoot
$RESOURCE_GROUP = "rg-edwin-slides"
$APP_NAME = "app-edwin-slides"

Write-Host "=== Edwin Slides Creator - Build & Deploy ===" -ForegroundColor Cyan

if (-not $SkipBuild) {
    # Step 1: Build frontend
    Write-Host "`n[1/4] Building frontend..." -ForegroundColor Yellow
    Push-Location "$ROOT\slide-generator"
    npm run build
    if ($LASTEXITCODE -ne 0) { Pop-Location; throw "Frontend build failed" }
    Pop-Location

    # Step 2: Compile backend TypeScript
    Write-Host "`n[2/4] Compiling backend..." -ForegroundColor Yellow
    Push-Location "$ROOT\backend"
    npm run build
    if ($LASTEXITCODE -ne 0) { Pop-Location; throw "Backend build failed" }
    Pop-Location

    # Step 3: Copy frontend build into backend/public
    Write-Host "`n[3/4] Copying frontend assets to backend/public..." -ForegroundColor Yellow
    $publicDir = "$ROOT\backend\public"
    if (Test-Path $publicDir) { Remove-Item $publicDir -Recurse -Force }
    Copy-Item -Path "$ROOT\slide-generator\dist" -Destination $publicDir -Recurse

    # Step 4: Create deployment zip
    Write-Host "`n[4/4] Creating deployment package..." -ForegroundColor Yellow
    $deployTemp = "$ROOT\deploy-temp"
    $zipPath = "$ROOT\edwin-slides.zip"

    if (Test-Path $deployTemp) { Remove-Item $deployTemp -Recurse -Force }
    if (Test-Path $zipPath) { Remove-Item $zipPath -Force }

    New-Item -ItemType Directory -Path $deployTemp | Out-Null

    Copy-Item -Path "$ROOT\backend\dist" -Destination "$deployTemp\dist" -Recurse
    Copy-Item -Path "$ROOT\backend\public" -Destination "$deployTemp\public" -Recurse
    if (Test-Path "$ROOT\backend\assets") {
        Copy-Item -Path "$ROOT\backend\assets" -Destination "$deployTemp\assets" -Recurse
    }
    Copy-Item -Path "$ROOT\backend\package.json" -Destination "$deployTemp\package.json"
    Copy-Item -Path "$ROOT\backend\package-lock.json" -Destination "$deployTemp\package-lock.json" -ErrorAction SilentlyContinue

    # Install production-only dependencies in the staging directory
    Push-Location $deployTemp
    npm install --omit=dev
    Pop-Location

    # Use tar to create zip (forward slashes required for Linux App Service)
    tar -a -cf $zipPath -C $deployTemp .
    Remove-Item $deployTemp -Recurse -Force

    $zipSize = [math]::Round((Get-Item $zipPath).Length / 1MB, 2)
    Write-Host "Deployment package created: $zipPath ($zipSize MB)" -ForegroundColor Green
}

if (-not $SkipDeploy) {
    $zipPath = "$ROOT\edwin-slides.zip"
    if (-not (Test-Path $zipPath)) {
        throw "Deployment package not found at $zipPath. Run without -SkipBuild first."
    }

    Write-Host "`nDeploying to Azure App Service: $APP_NAME..." -ForegroundColor Yellow
    az webapp deploy `
        --resource-group $RESOURCE_GROUP `
        --name $APP_NAME `
        --src-path $zipPath `
        --type zip `
        --restart true

    if ($LASTEXITCODE -ne 0) { throw "Azure deployment failed" }

    Write-Host "`nDeployment complete!" -ForegroundColor Green
    Write-Host "URL: https://$APP_NAME.azurewebsites.net/" -ForegroundColor Cyan
}
