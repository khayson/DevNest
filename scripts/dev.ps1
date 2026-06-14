# Start DevNest development environment (Windows)
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$Backend = Join-Path $Root "backend"
$Frontend = Join-Path $Root "frontend"

function Get-ListenerPid($port) {
    $line = netstat -ano | Select-String "127.0.0.1:$port\s+.*LISTENING" | Select-Object -First 1
    if ($line -match "\s(\d+)\s*$") { return [int]$Matches[1] }
    return $null
}

Write-Host "==> Building Go daemon..." -ForegroundColor Cyan
Push-Location $Backend
go build -o devnest.exe .
if ($LASTEXITCODE -ne 0) { Pop-Location; exit 1 }
Pop-Location

$devnestExe = Join-Path $Backend "devnest.exe"

# Control API (port 9089) — lets the dashboard start/stop the daemon without a terminal
if (-not (Get-ListenerPid 9089)) {
    Write-Host "==> Starting control API on http://127.0.0.1:9089 ..." -ForegroundColor Cyan
    Start-Process -FilePath $devnestExe -ArgumentList "launcher" -WorkingDirectory $Backend -WindowStyle Hidden | Out-Null
    Start-Sleep -Milliseconds 600
}

if (-not (Get-ListenerPid 9090)) {
    Write-Host "==> Starting daemon on ws://127.0.0.1:9090/ws ..." -ForegroundColor Cyan
    try {
        Invoke-RestMethod -Method POST -Uri "http://127.0.0.1:9089/api/daemon/start" -TimeoutSec 30 | Out-Null
        Write-Host "    Daemon ready (via control API)" -ForegroundColor DarkGray
    } catch {
        Write-Host "    Control API unavailable — starting daemon directly" -ForegroundColor Yellow
        Start-Process -FilePath $devnestExe -ArgumentList "daemon" -WorkingDirectory $Backend -WindowStyle Normal | Out-Null
        Start-Sleep -Seconds 2
    }
} else {
    Write-Host "==> Daemon already running on port 9090" -ForegroundColor Yellow
}

Write-Host "==> Starting frontend on http://localhost:5173 ..." -ForegroundColor Cyan
Write-Host "    Manage the daemon from General → Start/Stop/Restart environment" -ForegroundColor DarkGray
Push-Location $Frontend
if (-not (Test-Path "node_modules")) {
    Write-Host "    Installing npm dependencies..." -ForegroundColor DarkGray
    npm install
}
npm run dev
Pop-Location
