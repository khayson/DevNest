# Build latest.json for GitHub Releases (Tauri updater manifest).
param(
    [Parameter(Mandatory = $true)]
    [string]$Version,
    [Parameter(Mandatory = $true)]
    [string]$InstallerPath,
    [Parameter(Mandatory = $true)]
    [string]$SignaturePath,
    [string]$OutPath = "latest.json",
    [string]$Notes = "DevNest release"
)

$ErrorActionPreference = "Stop"
if (-not (Test-Path $InstallerPath)) { throw "Installer not found: $InstallerPath" }
if (-not (Test-Path $SignaturePath)) { throw "Signature not found: $SignaturePath" }

$sig = (Get-Content $SignaturePath -Raw).Trim()
$fileName = Split-Path $InstallerPath -Leaf
$pubDate = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")

$manifest = @{
    version = $Version
    notes   = $Notes
    pub_date = $pubDate
    platforms = @{
        "windows-x86_64" = @{
            signature = $sig
            url       = "https://github.com/khayson/DevNest/releases/download/v$Version/$fileName"
        }
    }
}

$manifest | ConvertTo-Json -Depth 6 | Set-Content $OutPath -Encoding utf8
Write-Host "Wrote $OutPath" -ForegroundColor Green
