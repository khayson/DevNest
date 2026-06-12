# Stop DevNest daemon and child services (Caddy, mail, dump ports)
$ErrorActionPreference = "SilentlyContinue"

function Get-ListenerPid($port) {
    $line = netstat -ano | Select-String "127.0.0.1:$port\s+.*LISTENING" | Select-Object -First 1
    if ($line -match "\s(\d+)\s*$") { return [int]$Matches[1] }
    return $null
}

function Should-StopProcess($proc) {
    if (-not $proc) { return $false }
    $name = $proc.ProcessName.ToLower()
    if ($name -in @("devnest", "caddy", "go", "php", "php-cgi")) { return $true }
    try {
        $path = $proc.Path
        if ($path -and $path -like "*\.devnest\*") { return $true }
        if ($path -and $path -like "*\DevNest\backend\*") { return $true }
    } catch { }
    return $false
}

# DevNest-specific ports (always safe to stop when matched to our binaries)
$corePorts = @(9090, 1025, 9912, 2019, 9074)
$pids = @()

foreach ($port in $corePorts) {
    $listenerPid = Get-ListenerPid $port
    if ($listenerPid) {
        $proc = Get-Process -Id $listenerPid -ErrorAction SilentlyContinue
        if (Should-StopProcess $proc) { $pids += $listenerPid }
        elseif ($proc) {
            Write-Host "Port $port is used by $($proc.ProcessName) (PID $listenerPid) - not a DevNest process, skipping." -ForegroundColor DarkYellow
        }
    }
}

# Caddy on :80
$pid80 = Get-ListenerPid 80
if ($pid80) {
    $proc = Get-Process -Id $pid80 -ErrorAction SilentlyContinue
    if ($proc -and $proc.ProcessName -eq "caddy") { $pids += $pid80 }
}

# Orphan Caddy from ~/.devnest
Get-Process -Name "caddy" -ErrorAction SilentlyContinue | ForEach-Object {
    $pids += $_.Id
}

$pids = $pids | Where-Object { $_ -ne $null } | Select-Object -Unique

if ($pids.Count -eq 0) {
    Write-Host "No DevNest services found (checked 9090, 2019, 80, 1025, 9912, 9074)." -ForegroundColor DarkGray
    exit 0
}

foreach ($procId in $pids) {
    $proc = Get-Process -Id $procId -ErrorAction SilentlyContinue
    $name = if ($proc) { $proc.ProcessName } else { "PID $procId" }
    Write-Host "Stopping $name (PID $procId)..." -ForegroundColor Yellow
    Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue
}

Start-Sleep -Seconds 1
Write-Host "Done. DevNest ports should be free." -ForegroundColor Green
