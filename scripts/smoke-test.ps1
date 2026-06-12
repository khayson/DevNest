# DevNest smoke test - verify daemon and core services before moving to the next phase
$ErrorActionPreference = "Continue"

$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$Pass = 0
$Fail = 0
$Warn = 0

function Test-Port {
    param([string]$Name, [string]$HostName, [int]$Port, [switch]$Optional)
    try {
        $client = New-Object System.Net.Sockets.TcpClient
        $client.Connect($HostName, $Port)
        $client.Close()
        Write-Host "[PASS] $Name listening on ${HostName}:$Port" -ForegroundColor Green
        $script:Pass++
        return $true
    } catch {
        if ($Optional) {
            Write-Host "[WARN] $Name not on ${HostName}:$Port (optional)" -ForegroundColor Yellow
            $script:Warn++
        } else {
            Write-Host "[FAIL] $Name not reachable on ${HostName}:$Port" -ForegroundColor Red
            $script:Fail++
        }
        return $false
    }
}

function Test-Http {
    param([string]$Name, [string]$Url, [switch]$Optional)
    try {
        $r = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 3
        Write-Host "[PASS] $Name responded ($($r.StatusCode)) at $Url" -ForegroundColor Green
        $script:Pass++
        return $true
    } catch {
        if ($Optional) {
            Write-Host "[WARN] $Name at $Url ($($_.Exception.Message))" -ForegroundColor Yellow
            $script:Warn++
        } else {
            Write-Host "[FAIL] $Name at $Url ($($_.Exception.Message))" -ForegroundColor Red
            $script:Fail++
        }
        return $false
    }
}

Write-Host ""
Write-Host "=== DevNest smoke test ===" -ForegroundColor Cyan
Write-Host ""

# 1. Core ports
Write-Host "--- Ports ---" -ForegroundColor Cyan
Test-Port "Daemon WebSocket" "127.0.0.1" 9090 | Out-Null
Test-Port "Mail SMTP" "127.0.0.1" 1025 | Out-Null
Test-Port "Dump server" "127.0.0.1" 9912 | Out-Null
Test-Port "DNS resolver" "127.0.0.1" 53 -Optional | Out-Null
Test-Port "Caddy HTTP" "127.0.0.1" 80 -Optional | Out-Null
Test-Port "Caddy admin" "127.0.0.1" 2019 -Optional | Out-Null

Write-Host ""
Write-Host "--- HTTP checks ---" -ForegroundColor Cyan
Test-Http "Caddy admin API" "http://127.0.0.1:2019/config/" -Optional | Out-Null

# 2. Mail capture
Write-Host ""
Write-Host "--- Mail capture ---" -ForegroundColor Cyan
if (Test-Port "Mail SMTP" "127.0.0.1" 1025) {
    & (Join-Path $Root "scripts\send-test-mail.ps1") -Quiet 2>&1 | Out-Null
    if ($LASTEXITCODE -eq 0 -or $?) {
        Write-Host "[PASS] Test email sent to port 1025 - check Mail tab in UI" -ForegroundColor Green
        $Pass++
    } else {
        Write-Host "[FAIL] send-test-mail.ps1 failed" -ForegroundColor Red
        $Fail++
    }
}

# 3. Dump capture
Write-Host ""
Write-Host "--- Dump capture ---" -ForegroundColor Cyan
if (Test-Port "Dump server" "127.0.0.1" 9912) {
    & (Join-Path $Root "scripts\send-test-dump.ps1") -Quiet 2>&1 | Out-Null
    if ($LASTEXITCODE -eq 0 -or $?) {
        Write-Host "[PASS] Test dump sent to port 9912 - check Dumps tab (click Sync)" -ForegroundColor Green
        $Pass++
    } else {
        Write-Host "[FAIL] send-test-dump.ps1 failed" -ForegroundColor Red
        $Fail++
    }
}

# 4. Caddy binary
Write-Host ""
Write-Host "--- Caddy ---" -ForegroundColor Cyan
$caddyExe = Join-Path $env:USERPROFILE ".devnest\runtimes\caddy\caddy.exe"
if (Test-Path $caddyExe) {
    $ver = & $caddyExe version 2>&1 | Select-Object -First 1
    Write-Host "[PASS] Caddy binary: $ver" -ForegroundColor Green
    $Pass++
} elseif (Get-Command caddy -ErrorAction SilentlyContinue) {
    Write-Host "[PASS] Caddy on PATH" -ForegroundColor Green
    $Pass++
} else {
    Write-Host "[WARN] Caddy not installed - run .\scripts\install-caddy.ps1" -ForegroundColor Yellow
    $Warn++
}

# 5. Config file
Write-Host ""
Write-Host "--- Config ---" -ForegroundColor Cyan
$configPath = Join-Path $env:USERPROFILE ".devnest\devnest.json"
if (Test-Path $configPath) {
    Write-Host "[PASS] Config exists: $configPath" -ForegroundColor Green
    $Pass++
} else {
    Write-Host "[WARN] Config not found (created on first daemon run)" -ForegroundColor Yellow
    $Warn++
}

Write-Host ""
Write-Host "=== Summary ===" -ForegroundColor Cyan
Write-Host "  Passed:  $Pass" -ForegroundColor Green
Write-Host "  Failed:  $Fail" -ForegroundColor $(if ($Fail -gt 0) { "Red" } else { "Green" })
Write-Host "  Warnings: $Warn" -ForegroundColor Yellow
Write-Host ""
Write-Host "Manual UI checks:" -ForegroundColor Cyan
Write-Host "  1. General + Services both show same running count (e.g. 4/4)" -ForegroundColor Gray
Write-Host "  2. Mail tab - test email appears" -ForegroundColor Gray
Write-Host "  3. Dumps tab - test dump appears after Sync" -ForegroundColor Gray
Write-Host "  4. Sites - add a site, open https://yoursite.test (needs DNS on :53)" -ForegroundColor Gray
Write-Host ""

if ($Fail -gt 0) { exit 1 }
exit 0
