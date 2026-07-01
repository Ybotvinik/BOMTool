# Build production alpha images and export a tarball for offline EC2 deploy.
# Run from repo root. Output: dist/glintech-alpha-images.tar
#
# On EC2 after copying the tar:
#   docker load -i glintech-alpha-images.tar
#   docker compose -f docker-compose.aws.yml --env-file .env.aws up -d --no-build

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

$envFile = Join-Path $Root ".env.aws"
if (-not (Test-Path $envFile)) {
    if (Test-Path (Join-Path $Root ".env.aws.example")) {
        Copy-Item (Join-Path $Root ".env.aws.example") $envFile
    }
    Write-Host "Created .env.aws — set PUBLIC_HOST before building frontend (API URL is baked in)."
}

Get-Content $envFile | ForEach-Object {
    if ($_ -match '^\s*([^#][^=]+)=(.*)$') {
        Set-Item -Path "env:$($matches[1].Trim())" -Value $matches[2].Trim()
    }
}

if (-not $env:PUBLIC_HOST -or $env:PUBLIC_HOST -eq "YOUR_EC2_PUBLIC_IP_OR_DNS") {
    Write-Warning "PUBLIC_HOST is not set — using 127.0.0.1 for NEXT_PUBLIC_API_URL build arg."
    $env:PUBLIC_HOST = "127.0.0.1"
}

$tag = if ($env:IMAGE_TAG) { $env:IMAGE_TAG } else { "alpha" }
$dist = Join-Path $Root "dist"
New-Item -ItemType Directory -Force -Path $dist | Out-Null

$tarPath = Join-Path $dist "glintech-alpha-images.tar"

$backendPort = if ($env:BACKEND_PORT) { $env:BACKEND_PORT } else { "8000" }

Write-Host "Building images (tag: $tag, API URL: http://$($env:PUBLIC_HOST):$backendPort)..."
docker compose -f docker-compose.aws.yml --env-file $envFile build

if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

$backendImage = "glintech-bom-backend:$tag"
$frontendImage = "glintech-bom-frontend:$tag"

Write-Host "Saving $backendImage and $frontendImage to $tarPath ..."
docker save -o $tarPath $backendImage $frontendImage

Write-Host ""
Write-Host "Package ready:"
Write-Host "  $tarPath"
Write-Host ""
Write-Host "Copy to EC2, then:"
Write-Host "  docker load -i glintech-alpha-images.tar"
Write-Host "  docker compose -f docker-compose.aws.yml --env-file .env.aws up -d --no-build"
