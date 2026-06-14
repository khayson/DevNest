# Production release build for Windows desktop installer.
param(
    [string]$Version = "0.1.2",
    [switch]$Launch,
    [switch]$SignedUpdates,
    [string]$SigningPassword = ""
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path | Split-Path -Parent
$Backend = Join-Path $Root "backend"
$Frontend = Join-Path $Root "frontend"
$TauriDir = Join-Path $Frontend "src-tauri"
$BinDir = Join-Path $TauriDir "binaries"
$SidecarName = "devnest-x86_64-pc-windows-msvc.exe"
$PrivateKey = Join-Path $env:USERPROFILE ".devnest\keys\devnest-updater.key"

Write-Host "==> Building Go daemon sidecar..." -ForegroundColor Cyan
Push-Location $Backend
$SidecarBuild = Join-Path $Backend "devnest-sidecar-build.exe"
go build -ldflags "-s -w" -o $SidecarBuild .
if ($LASTEXITCODE -ne 0) { Pop-Location; exit 1 }
Pop-Location

New-Item -ItemType Directory -Force -Path $BinDir | Out-Null
Copy-Item $SidecarBuild (Join-Path $BinDir $SidecarName) -Force
Remove-Item $SidecarBuild -Force -ErrorAction SilentlyContinue

if (-not $env:TAURI_SIGNING_PRIVATE_KEY -and (Test-Path $PrivateKey)) {
    $env:TAURI_SIGNING_PRIVATE_KEY = $PrivateKey
}

if ($SignedUpdates -or $env:TAURI_SIGNING_PRIVATE_KEY) {
    if (-not $env:TAURI_SIGNING_PRIVATE_KEY) {
        Write-Error "SignedUpdates requires TAURI_SIGNING_PRIVATE_KEY or $PrivateKey. Run generate-updater-keys.ps1 first."
    }
    if ($SigningPassword) {
        $env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD = $SigningPassword
    } else {
        Remove-Item Env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD -ErrorAction SilentlyContinue
    }
    Write-Host "==> Building with signed updater artifacts..." -ForegroundColor Green
}

Push-Location $Frontend
if (-not (Test-Path "node_modules")) { npm install }
npm run build
if ($LASTEXITCODE -ne 0) { Pop-Location; exit 1 }

if ($env:TAURI_SIGNING_PRIVATE_KEY) {
    $ReleaseConfig = Join-Path $TauriDir "tauri.release.conf.json"
    npx tauri build --config $ReleaseConfig
} else {
    Write-Host "==> Building installer (no updater signing — run generate-updater-keys.ps1 for in-app updates)" -ForegroundColor Yellow
    npx tauri build
}
$buildExit = $LASTEXITCODE
Pop-Location

if ($buildExit -ne 0) { exit $buildExit }

$BundleDir = Join-Path $TauriDir "target\release\bundle\nsis"
Write-Host ""
Write-Host "Release build complete (v$Version)" -ForegroundColor Green
if (Test-Path $BundleDir) {
    Get-ChildItem $BundleDir -Filter "*.exe" | ForEach-Object {
        Write-Host "  Installer: $($_.FullName)" -ForegroundColor Green
    }
}

if ($Launch) {
    $exe = Join-Path $TauriDir "target\release\DevNest.exe"
    if (Test-Path $exe) { Start-Process $exe }
}

Write-Host ""
Write-Host "Publish: create GitHub release v$Version and upload the NSIS .exe" -ForegroundColor Cyan
Write-Host "See DISTRIBUTION.md for signing keys and latest.json" -ForegroundColor Cyan
