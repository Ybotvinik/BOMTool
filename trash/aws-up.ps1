# Start / update the full AWS alpha stack (Postgres + API + Next.js production).
# Run from repo root in PowerShell. Requires Docker Desktop.

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

$envFile = Join-Path $Root ".env.aws"
if (-not (Test-Path $envFile)) {
    Copy-Item (Join-Path $Root ".env.aws.example") $envFile
    Write-Host "Created .env.aws — set PUBLIC_HOST and POSTGRES_PASSWORD, then run again."
    exit 1
}

Get-Content $envFile | ForEach-Object {
    if ($_ -match '^\s*([^#][^=]+)=(.*)$') {
        $name = $matches[1].Trim()
        $value = $matches[2].Trim()
        Set-Item -Path "env:$name" -Value $value
    }
}

if (-not $env:PUBLIC_HOST -or $env:PUBLIC_HOST -eq "YOUR_EC2_PUBLIC_IP_OR_DNS") {
    Write-Error "Edit .env.aws: set PUBLIC_HOST to this server's public IP or DNS."
}

if (-not (Test-Path (Join-Path $Root "backend\.env"))) {
    Write-Error "Missing backend\.env — copy backend\.env.example and add API keys."
}

$frontendPort = if ($env:FRONTEND_PORT) { $env:FRONTEND_PORT } else { "3000" }
$backendPort = if ($env:BACKEND_PORT) { $env:BACKEND_PORT } else { "8000" }
$tag = if ($env:IMAGE_TAG) { $env:IMAGE_TAG } else { "alpha" }

Write-Host "IMAGE_TAG=$tag"
Write-Host "PUBLIC_HOST=$($env:PUBLIC_HOST)"
Write-Host "App:    http://$($env:PUBLIC_HOST):$frontendPort"
Write-Host "Health: http://$($env:PUBLIC_HOST):$backendPort/health"
Write-Host ""

docker compose -f docker-compose.aws.yml --env-file $envFile up -d --build

if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host ""
Write-Host "Done. Check status:"
docker compose -f docker-compose.aws.yml --env-file $envFile ps
