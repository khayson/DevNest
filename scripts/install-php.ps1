# Install PHP for DevNest (Windows)
# Downloads Thread Safe build to ~/.devnest/runtimes/php/ (where the daemon scans)
$ErrorActionPreference = "Stop"

$PhpVersion = "8.3.21"
$PhpDir = Join-Path $env:USERPROFILE ".devnest\runtimes\php\php-$PhpVersion"
$PhpExe = Join-Path $PhpDir "php.exe"
$ZipName = "php-$PhpVersion-Win32-vs16-x64.zip"
$DownloadUrl = "https://windows.php.net/downloads/releases/$ZipName"
$WingetId = "PHP.PHP.8.3"

function Test-PhpReady {
    if (Test-Path $PhpExe) { return $true }
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" +
                [System.Environment]::GetEnvironmentVariable("Path", "User")
    return [bool](Get-Command php -ErrorAction SilentlyContinue)
}

function Write-Success {
    Write-Host ""
    Write-Host "PHP is ready." -ForegroundColor Green
    if (Test-Path $PhpExe) {
        Write-Host "Binary: $PhpExe" -ForegroundColor DarkGray
    }
    Write-Host ""
    Write-Host "Next steps:" -ForegroundColor Cyan
    Write-Host "  1. Restart the daemon: .\scripts\stop-daemon.ps1 then .\scripts\dev.ps1" -ForegroundColor Gray
    Write-Host "  2. Open PHP tab and set the active version" -ForegroundColor Gray
    Write-Host "  3. Start PHP CGI from the Services page (port 9074)" -ForegroundColor Gray
}

Write-Host "DevNest uses PHP CGI for Laravel sites (Caddy php_fastcgi on port 9074)." -ForegroundColor Cyan
Write-Host ""

if (Test-PhpReady) {
    Write-Success
    exit 0
}

try {
    New-Item -ItemType Directory -Force -Path $PhpDir | Out-Null
    $zipPath = Join-Path $env:TEMP "devnest-$ZipName"

    Write-Host "Downloading PHP $PhpVersion to DevNest runtimes..." -ForegroundColor Yellow
    Invoke-WebRequest -Uri $DownloadUrl -OutFile $zipPath -UseBasicParsing

    Write-Host "Extracting..." -ForegroundColor Yellow
    Expand-Archive -Path $zipPath -DestinationPath $PhpDir -Force
    Remove-Item $zipPath -Force -ErrorAction SilentlyContinue

    # Copy php.ini-development to php.ini if missing
    $iniDev = Join-Path $PhpDir "php.ini-development"
    $ini = Join-Path $PhpDir "php.ini"
    if ((Test-Path $iniDev) -and -not (Test-Path $ini)) {
        Copy-Item $iniDev $ini
        Write-Host "Created php.ini from php.ini-development" -ForegroundColor DarkGray
    }

    if (-not (Test-Path $PhpExe)) {
        throw "php.exe not found after extract"
    }

    Write-Success
    exit 0
} catch {
    Write-Host "Direct download failed: $($_.Exception.Message)" -ForegroundColor Red
}

if (Get-Command winget -ErrorAction SilentlyContinue) {
    Write-Host ""
    Write-Host "Trying winget ($WingetId)..." -ForegroundColor Yellow
    winget install --id $WingetId -e --accept-source-agreements --accept-package-agreements
    if ($LASTEXITCODE -eq 0) {
        Start-Sleep -Seconds 1
        if (Test-PhpReady) {
            Write-Success
            exit 0
        }
        Write-Host "winget installed PHP but PATH is not updated in this shell." -ForegroundColor Yellow
        Write-Host "Open a new terminal and restart the DevNest daemon." -ForegroundColor Yellow
        exit 0
    }
}

Write-Host ""
Write-Host "ERROR: Could not install PHP." -ForegroundColor Red
Write-Host "Manual: download from https://windows.php.net/download/" -ForegroundColor Gray
Write-Host "Extract to: $PhpDir" -ForegroundColor Gray
Write-Host "Or run: winget install $WingetId" -ForegroundColor Gray
exit 1
