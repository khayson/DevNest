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

$existingPid = Get-ListenerPid 9090
$startedByScript = $false
$daemon = $null

if ($existingPid) {
    Write-Host "==> Daemon already running (PID $existingPid on port 9090) — skipping start." -ForegroundColor Yellow
    Write-Host "    To restart: .\scripts\stop-daemon.ps1 then run this script again." -ForegroundColor DarkGray
} else {
    Write-Host "==> Starting daemon on ws://127.0.0.1:9090/ws ..." -ForegroundColor Cyan
    $daemon = Start-Process -FilePath (Join-Path $Backend "devnest.exe") `
        -ArgumentList "daemon" `
        -WorkingDirectory $Backend `
        -PassThru `
        -WindowStyle Normal
    $startedByScript = $true
    Write-Host "    Daemon PID: $($daemon.Id)" -ForegroundColor DarkGray
    Start-Sleep -Seconds 2
}

Write-Host "==> Starting frontend on http://localhost:5173 ..." -ForegroundColor Cyan
Push-Location $Frontend
if (-not (Test-Path "node_modules")) {
    Write-Host "    Installing npm dependencies..." -ForegroundColor DarkGray
    npm install
}
try {
    npm run dev
} finally {
    Pop-Location
    if ($startedByScript -and $daemon -and -not $daemon.HasExited) {
        Write-Host "`n==> Stopping daemon (PID $($daemon.Id))..." -ForegroundColor Yellow
        Stop-Process -Id $daemon.Id -Force -ErrorAction SilentlyContinue
    }
}
