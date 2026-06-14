# Generate Tauri updater signing keys (run once per machine/org).
# Private key stays in ~/.devnest/keys/ — NEVER commit it.
param(
    [switch]$Force,
    [string]$Password = "devnest1234"
)

$ErrorActionPreference = "Stop"
$KeysDir = Join-Path $env:USERPROFILE ".devnest\keys"
$KeyPath = Join-Path $KeysDir "devnest-updater.key"
$PubDest = Join-Path (Split-Path $PSScriptRoot -Parent) "frontend\src-tauri\updater.pubkey"

New-Item -ItemType Directory -Force -Path $KeysDir | Out-Null

Push-Location (Join-Path (Split-Path $PSScriptRoot -Parent) "frontend")
$args = @("signer", "generate", "-w", $KeyPath, "-p", $Password)
if ($Force) { $args += "-f" }
npx tauri @args
if ($LASTEXITCODE -ne 0) { Pop-Location; exit 1 }
Pop-Location

$PubPath = "$KeyPath.pub"
if (-not (Test-Path $PubPath)) {
    Write-Error "Expected public key at $PubPath"
}
Copy-Item $PubPath $PubDest -Force
Write-Host "Public key written to: $PubDest" -ForegroundColor Green
Write-Host "Private key (keep secret): $KeyPath" -ForegroundColor Yellow
Write-Host "Signing password: set TAURI_SIGNING_PRIVATE_KEY_PASSWORD or use release.ps1 -SigningPassword" -ForegroundColor Cyan
& (Join-Path $PSScriptRoot "sync-updater-pubkey.ps1")
