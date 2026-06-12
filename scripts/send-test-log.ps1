# Append Laravel-style test log lines for DevNest log aggregator testing
param(
    [int]$Count = 5,
    [ValidateSet("devnest", "laravel", "caddy")]
    [string]$Target = "devnest",
    [string]$LaravelPath = ""
)

$ErrorActionPreference = "Stop"

function Get-LogPath {
    param([string]$Target, [string]$LaravelPath)

    $devnestLogs = Join-Path $env:USERPROFILE ".devnest\logs\devnest.log"
    $caddyLog = Join-Path $env:USERPROFILE ".devnest\caddy\caddy.log"

    switch ($Target) {
        "devnest" { return $devnestLogs }
        "caddy" { return $caddyLog }
        "laravel" {
            if ($LaravelPath) {
                return Join-Path $LaravelPath "storage\logs\laravel.log"
            }
            return Join-Path $env:USERPROFILE ".devnest\logs\laravel-test.log"
        }
    }
}

function Get-LaravelLogLines {
    $now = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    @(
        "[$now] local.INFO: User logged in successfully {\"user_id\":42}"
        "[$now] local.DEBUG: Cache hit for key app.settings {\"ttl\":3600}"
        "[$now] local.WARNING: Slow query detected {\"sql\":\"select * from orders\",\"time_ms\":842}"
        "[$now] local.ERROR: SQLSTATE[HY000]: General error: 1364 Field 'email' doesn't have a default value"
        "[$now] local.INFO: Mail sent to customer@example.test {\"mailable\":\"App\\Mail\\OrderShipped\"}"
        "[$now] local.INFO: Queue job processed {\"job\":\"App\\Jobs\\SendNewsletter\",\"attempts\":1}"
        "[$now] local.ERROR: Undefined array key \"discount\" {\"exception\":\"ErrorException\",\"file\":\"app/Http/Controllers/CheckoutController.php\",\"line\":88}"
        "[$now] local.INFO: HTTP request completed {\"method\":\"GET\",\"url\":\"/api/orders\",\"status\":200,\"duration_ms\":45}"
    )
}

$logPath = Get-LogPath -Target $Target -LaravelPath $LaravelPath
$dir = Split-Path -Parent $logPath
if (-not (Test-Path $dir)) {
    New-Item -ItemType Directory -Path $dir -Force | Out-Null
}
if (-not (Test-Path $logPath)) {
    New-Item -ItemType File -Path $logPath -Force | Out-Null
}

$templates = Get-LaravelLogLines
$written = 0

for ($i = 0; $i -lt $Count; $i++) {
    $line = $templates[$i % $templates.Count]
    Add-Content -Path $logPath -Value $line -Encoding UTF8
    $written++
    Start-Sleep -Milliseconds 30
}

Write-Host "Appended $written log line(s) to:" -ForegroundColor Green
Write-Host "  $logPath" -ForegroundColor DarkGray
Write-Host "Open the Logs tab in DevNest (lines stream via WebSocket)." -ForegroundColor Cyan
