# Build DevNest desktop app (Windows) — run once, then use Open-DevNest.vbs
param(
    [switch]$Launch
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$Backend = Join-Path $Root "backend"
$Frontend = Join-Path $Root "frontend"
$BinDir = Join-Path $Frontend "src-tauri\binaries"
$SidecarName = "devnest-x86_64-pc-windows-msvc.exe"
$ReleaseExe = Join-Path $Frontend "src-tauri\target\release\DevNest.exe"

Push-Location $Backend
go build -o devnest.exe .
if ($LASTEXITCODE -ne 0) { Pop-Location; exit 1 }
Pop-Location

New-Item -ItemType Directory -Force -Path $BinDir | Out-Null
Copy-Item (Join-Path $Backend "devnest.exe") (Join-Path $BinDir $SidecarName) -Force

Push-Location $Frontend
if (-not (Test-Path "node_modules")) { npm install }
npm run build
if ($LASTEXITCODE -ne 0) { Pop-Location; exit 1 }
npx tauri build
if ($LASTEXITCODE -ne 0) { Pop-Location; exit 1 }
Pop-Location

if ($Launch -and (Test-Path $ReleaseExe)) {
    Start-Process $ReleaseExe
}

Write-Host "Desktop app: $ReleaseExe" -ForegroundColor Green
