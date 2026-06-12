# Install Caddy for DevNest site proxying (Windows)
# Downloads to ~/.devnest/runtimes/caddy/ (where the daemon looks first)
$ErrorActionPreference = "Stop"

$CaddyDir = Join-Path $env:USERPROFILE ".devnest\runtimes\caddy"
$CaddyExe = Join-Path $CaddyDir "caddy.exe"
$CaddyVersion = "2.11.4"
$DownloadUrl = "https://github.com/caddyserver/caddy/releases/download/v$CaddyVersion/caddy_${CaddyVersion}_windows_amd64.zip"
$WingetId = "CaddyServer.Caddy"

function Test-CaddyReady {
    if (Test-Path $CaddyExe) { return $true }
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" +
                [System.Environment]::GetEnvironmentVariable("Path", "User")
    return [bool](Get-Command caddy -ErrorAction SilentlyContinue)
}

function Write-Success {
    Write-Host ""
    Write-Host "Caddy is ready." -ForegroundColor Green
    if (Test-Path $CaddyExe) {
        Write-Host "Binary: $CaddyExe" -ForegroundColor DarkGray
    }
    Write-Host ""
    Write-Host "Next steps:" -ForegroundColor Cyan
    Write-Host "  1. Restart the daemon: .\scripts\stop-daemon.ps1 then .\scripts\dev.ps1" -ForegroundColor Gray
    Write-Host "  2. Open Services and start Caddy Reverse Proxy" -ForegroundColor Gray
    Write-Host "  3. Add sites in the Sites tab" -ForegroundColor Gray
}

Write-Host "DevNest uses Caddy to serve *.test sites with local HTTPS." -ForegroundColor Cyan
Write-Host ""

if (Test-CaddyReady) {
    Write-Success
    exit 0
}

# Primary: download directly to ~/.devnest/runtimes/caddy/ (DevNest resolves this path)
try {
    New-Item -ItemType Directory -Force -Path $CaddyDir | Out-Null
    $zipPath = Join-Path $env:TEMP "devnest-caddy-$CaddyVersion.zip"

    Write-Host "Downloading Caddy $CaddyVersion to DevNest runtimes..." -ForegroundColor Yellow
    Invoke-WebRequest -Uri $DownloadUrl -OutFile $zipPath -UseBasicParsing

    Write-Host "Extracting..." -ForegroundColor Yellow
    Expand-Archive -Path $zipPath -DestinationPath $CaddyDir -Force
    Remove-Item $zipPath -Force -ErrorAction SilentlyContinue

    if (-not (Test-Path $CaddyExe)) {
        throw "caddy.exe not found after extract"
    }

    Write-Success
    exit 0
} catch {
    Write-Host "Direct download failed: $($_.Exception.Message)" -ForegroundColor Red
}

# Fallback: winget (adds caddy to system PATH)
if (Get-Command winget -ErrorAction SilentlyContinue) {
    Write-Host ""
    Write-Host "Trying winget ($WingetId)..." -ForegroundColor Yellow
    winget install --id $WingetId -e --accept-source-agreements --accept-package-agreements
    if ($LASTEXITCODE -eq 0) {
        Start-Sleep -Seconds 1
        if (Test-CaddyReady) {
            Write-Success
            exit 0
        }
        Write-Host "winget installed Caddy but PATH is not updated in this shell." -ForegroundColor Yellow
        Write-Host "Open a new terminal and restart the DevNest daemon." -ForegroundColor Yellow
        exit 0
    }
}

Write-Host ""
Write-Host "ERROR: Could not install Caddy." -ForegroundColor Red
Write-Host "Manual: download from https://caddyserver.com/download" -ForegroundColor Gray
Write-Host "Place caddy.exe in: $CaddyDir" -ForegroundColor Gray
Write-Host "Or run: winget install $WingetId" -ForegroundColor Gray
exit 1
