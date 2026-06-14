# Copy public key from ~/.devnest/keys into tauri.conf.json (run after generate-updater-keys.ps1)
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path | Split-Path -Parent
$ConfPath = Join-Path $Root "frontend\src-tauri\tauri.conf.json"
$PubPath = Join-Path $Root "frontend\src-tauri\updater.pubkey"
$KeyPub = Join-Path $env:USERPROFILE ".devnest\keys\devnest-updater.key.pub"

if (-not (Test-Path $PubPath) -and (Test-Path $KeyPub)) {
    Copy-Item $KeyPub $PubPath -Force
}
if (-not (Test-Path $PubPath)) {
    Write-Error "Missing $PubPath — run generate-updater-keys.ps1 first"
}

$pub = (Get-Content $PubPath -Raw).Trim()
if ($pub.StartsWith("#") -or $pub.Length -lt 40) {
    Write-Error "updater.pubkey is still a placeholder — run generate-updater-keys.ps1"
}

$json = Get-Content $ConfPath -Raw | ConvertFrom-Json
if (-not $json.plugins) { $json | Add-Member -NotePropertyName plugins -NotePropertyValue (@{}) }
if (-not $json.plugins.updater) { $json.plugins | Add-Member -NotePropertyName updater -NotePropertyValue (@{}) }
$json.plugins.updater.pubkey = $pub
$json | ConvertTo-Json -Depth 20 | Set-Content $ConfPath -Encoding utf8
Write-Host "Embedded updater public key into tauri.conf.json" -ForegroundColor Green
