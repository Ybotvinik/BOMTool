# Start GlinTech BOM Insight for LAN alpha (office network).
# Run from repo root in PowerShell. Docker Desktop must be running.

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

$envFile = Join-Path $Root ".env.alpha"
if (-not (Test-Path $envFile)) {
    Copy-Item (Join-Path $Root ".env.alpha.example") $envFile
    Write-Host "Created .env.alpha from example — edit ALPHA_HOST_IP if needed."
}

$alphaIp = (Get-Content $envFile | Where-Object { $_ -match '^\s*ALPHA_HOST_IP=' }) -replace '^\s*ALPHA_HOST_IP=\s*', ''
$alphaIp = $alphaIp.Trim()
if (-not $alphaIp) {
    Write-Error "ALPHA_HOST_IP is empty in .env.alpha"
}

Write-Host "LAN alpha host IP: $alphaIp"
Write-Host "Colleagues open: http://${alphaIp}:3000"
Write-Host ""

# Optional firewall rules (requires Administrator).
$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if ($isAdmin) {
    foreach ($port in @(3000, 8000)) {
        $name = "GlinTech BOM Insight TCP $port"
        if (-not (Get-NetFirewallRule -DisplayName $name -ErrorAction SilentlyContinue)) {
            New-NetFirewallRule -DisplayName $name -Direction Inbound -LocalPort $port -Protocol TCP -Action Allow -Profile Private | Out-Null
            Write-Host "Firewall: allowed inbound TCP $port (Private)"
        }
    }
} else {
    Write-Host "Tip: re-run PowerShell as Administrator once to open firewall ports 3000 and 8000."
}

docker compose --env-file .env.alpha -f docker-compose.yml -f docker-compose.alpha.yml up -d --build

Write-Host ""
Write-Host "Health: http://${alphaIp}:8000/health"
Write-Host "App:    http://${alphaIp}:3000"
