# Create/update GitHub release and upload DevNest installer assets.
param(
    [string]$Version = "0.1.1",
    [string]$BundleDir = "",
    [switch]$Draft
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path | Split-Path -Parent
$TauriDir = Join-Path $Root "frontend\src-tauri"
if (-not $BundleDir) {
    $BundleDir = Join-Path $TauriDir "target\release\bundle\nsis"
}

if (-not (Test-Path $BundleDir)) {
    throw "Bundle directory not found: $BundleDir. Run .\scripts\release.ps1 first."
}

$installer = Get-ChildItem $BundleDir -Filter "DevNest_*_x64-setup.exe" | Select-Object -First 1
if (-not $installer) {
    throw "No NSIS installer found in $BundleDir"
}

$tag = "v$Version"
$assets = @($installer.FullName)
$sig = "$($installer.FullName).sig"
if (Test-Path $sig) { $assets += $sig }

$latestJson = Join-Path $Root "latest.json"
if (Test-Path $sig) {
    & (Join-Path $Root "scripts\make-latest-json.ps1") `
        -Version $Version `
        -InstallerPath $installer.FullName `
        -SignaturePath $sig `
        -OutPath $latestJson
}
if (Test-Path $latestJson) { $assets += $latestJson }

$gh = Get-Command gh -ErrorAction SilentlyContinue
if (-not $gh) {
    Write-Host "GitHub CLI (gh) not found." -ForegroundColor Yellow
    Write-Host "Upload manually at: https://github.com/khayson/DevNest/releases/new?tag=$tag" -ForegroundColor Cyan
    Write-Host "Assets to upload:" -ForegroundColor Cyan
    $assets | ForEach-Object { Write-Host "  $_" }
    exit 0
}

Write-Host "==> Creating release $tag..." -ForegroundColor Cyan
& gh release view $tag 2>$null
if ($LASTEXITCODE -ne 0) {
    $createArgs = @(
        "release", "create", $tag,
        "--title", "DevNest v$Version"
    )
    $notesPath = Join-Path $Root "docs\RELEASE_v$Version.md"
    if (Test-Path $notesPath) {
        $createArgs += "--notes-file"
        $createArgs += $notesPath
    } else {
        $createArgs += "--notes"
        $createArgs += "DevNest v$Version — Windows desktop installer."
    }
    if ($Draft) { $createArgs += "--draft" }
    & gh @createArgs
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}

foreach ($file in $assets) {
    Write-Host "==> Uploading $(Split-Path $file -Leaf)..." -ForegroundColor Cyan
    & gh release upload $tag $file --clobber
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}

Write-Host ""
Write-Host "Release published: https://github.com/khayson/DevNest/releases/tag/$tag" -ForegroundColor Green
