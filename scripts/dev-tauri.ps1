# Build backend, bundle sidecar binary, and launch Tauri desktop app (Windows)
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$Backend = Join-Path $Root "backend"
$Frontend = Join-Path $Root "frontend"
$BinDir = Join-Path $Frontend "src-tauri\binaries"
$SidecarName = "devnest-x86_64-pc-windows-msvc.exe"

Write-Host "==> Building Go daemon..." -ForegroundColor Cyan
Push-Location $Backend
go build -o devnest.exe .
if ($LASTEXITCODE -ne 0) { Pop-Location; exit 1 }
Pop-Location

Write-Host "==> Copying sidecar binary..." -ForegroundColor Cyan
New-Item -ItemType Directory -Force -Path $BinDir | Out-Null
Copy-Item (Join-Path $Backend "devnest.exe") (Join-Path $BinDir $SidecarName) -Force

$iconScript = Join-Path $Root "scripts\generate-app-icon.ps1"
if (-not (Test-Path (Join-Path $Frontend "src-tauri\icons\icon.ico"))) {
    if (Test-Path $iconScript) {
        Write-Host "==> Generating app icons..." -ForegroundColor Cyan
        & $iconScript
        Push-Location $Frontend
        npx tauri icon app-icon.png
        Pop-Location
    } else {
        Write-Host "==> Warning: icons missing — run scripts/generate-app-icon.ps1 && npx tauri icon" -ForegroundColor Yellow
    }
}

Write-Host "==> Starting Tauri desktop app..." -ForegroundColor Cyan
Push-Location $Frontend
if (-not (Test-Path "node_modules")) {
    npm install
}
npx tauri dev
