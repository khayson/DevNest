# Send Laravel-style test emails to the DevNest SMTP interceptor (port 1025)
param(
    [int]$Count = 1,
    [switch]$Quiet
)

$ErrorActionPreference = "Stop"

function Write-Log {
    param([string]$Message, [string]$Color = "Gray")
    if (-not $Quiet) { Write-Host $Message -ForegroundColor $Color }
}

function Get-LaravelMailTemplates {
    $app = "DevNest Shop"
    $baseFrom = "noreply@devnest-shop.test"

    @(
        @{
            From    = "$app <$baseFrom>"
            To      = "customer@example.test"
            Subject = "Reset Password Notification"
            Body    = @"
MIME-Version: 1.0
Content-Type: text/html; charset=UTF-8

<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Reset Password</title></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background:#f3f4f6; padding:32px;">
  <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
    <table width="600" style="background:#fff;border-radius:8px;padding:32px;">
      <tr><td>
        <h1 style="color:#111827;font-size:20px;margin:0 0 16px;">Reset your password</h1>
        <p style="color:#4b5563;line-height:1.6;">You are receiving this email because we received a password reset request for your account.</p>
        <p style="margin:24px 0;"><a href="https://devnest-shop.test/password/reset/abc123" style="background:#ef4444;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;display:inline-block;">Reset Password</a></p>
        <p style="color:#9ca3af;font-size:12px;">If you did not request a password reset, no further action is required.</p>
        <p style="color:#9ca3af;font-size:12px;margin-top:24px;">Regards,<br>$app</p>
      </td></tr>
    </table>
  </td></tr></table>
</body>
</html>
"@
        }
        @{
            From    = "$app <$baseFrom>"
            To      = "newuser@example.test"
            Subject = "Verify Email Address"
            Body    = @"
MIME-Version: 1.0
Content-Type: text/html; charset=UTF-8

<!DOCTYPE html>
<html><body style="font-family:system-ui;padding:24px;color:#374151;">
  <h2>Verify your email address</h2>
  <p>Please click the button below to verify your email address.</p>
  <p><a href="https://devnest-shop.test/email/verify/1/hash?expires=123" style="background:#2563eb;color:white;padding:10px 20px;border-radius:4px;text-decoration:none;">Verify Email Address</a></p>
  <p style="font-size:13px;color:#6b7280;">If you did not create an account, no further action is required.</p>
</body></html>
"@
        }
        @{
            From    = "orders@devnest-shop.test"
            To      = "customer@example.test"
            Subject = "Your order #DN-48291 has been confirmed"
            Body    = @"
MIME-Version: 1.0
Content-Type: text/html; charset=UTF-8

<!DOCTYPE html>
<html><body style="font-family:system-ui;padding:24px;">
  <h2>Order confirmed</h2>
  <p>Thanks for your purchase! Order <strong>#DN-48291</strong> is being prepared.</p>
  <table style="width:100%;border-collapse:collapse;margin:16px 0;">
    <tr style="border-bottom:1px solid #e5e7eb;"><td style="padding:8px;">Laravel Hoodie</td><td style="padding:8px;text-align:right;">$59.00</td></tr>
    <tr style="border-bottom:1px solid #e5e7eb;"><td style="padding:8px;">DevNest Sticker Pack</td><td style="padding:8px;text-align:right;">$12.00</td></tr>
    <tr><td style="padding:8px;font-weight:bold;">Total</td><td style="padding:8px;text-align:right;font-weight:bold;">$71.00</td></tr>
  </table>
</body></html>
"@
        }
        @{
            From    = "hello@devnest-shop.test"
            To      = "newuser@example.test"
            Subject = "Welcome to DevNest Shop!"
            Body    = @"
MIME-Version: 1.0
Content-Type: text/html; charset=UTF-8

<!DOCTYPE html>
<html><body style="font-family:system-ui;max-width:560px;margin:0 auto;padding:32px;">
  <h1 style="color:#059669;">Welcome aboard!</h1>
  <p>We're excited to have you. Your account is ready - explore the dashboard and configure your first site.</p>
  <ul style="color:#4b5563;line-height:1.8;">
    <li>Mail interceptor on port 1025</li>
    <li>Dump server on port 9912</li>
    <li>Local *.test domains via Caddy</li>
  </ul>
</body></html>
"@
        }
        @{
            From    = "notifications@devnest-shop.test"
            To      = "admin@example.test"
            Subject = "Invoice paid - INV-2026-0142"
            Body    = @"
MIME-Version: 1.0
Content-Type: text/plain; charset=UTF-8

Your invoice INV-2026-0142 for $149.00 has been paid.

Customer: Acme Corp
Plan: Pro (monthly)
Paid at: $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")

Thank you for using DevNest Shop.
"@
        }
        @{
            From    = "queue@devnest-shop.test"
            To      = "admin@example.test"
            Subject = "Failed job: App\Jobs\SendNewsletter"
            Body    = @"
MIME-Version: 1.0
Content-Type: text/plain; charset=UTF-8

A queued job has failed.

Connection: redis
Queue: default
Job: App\Jobs\SendNewsletter
Exception: Illuminate\Queue\MaxAttemptsExceededException

Payload:
{"uuid":"9b3c...","displayName":"App\\Jobs\\SendNewsletter","job":"Illuminate\\Queue\\CallQueuedHandler@call"}

Retry the job from the Horizon dashboard or run: php artisan queue:retry all
"@
        }
        @{
            From    = "security@devnest-shop.test"
            To      = "admin@example.test"
            Subject = "New login from Windows - DevNest Shop"
            Body    = @"
MIME-Version: 1.0
Content-Type: multipart/alternative; boundary="----=_DevNest_Boundary"

------=_DevNest_Boundary
Content-Type: text/plain; charset=UTF-8

New sign-in to your account from 127.0.0.1 (Windows).
If this wasn't you, reset your password immediately.

------=_DevNest_Boundary
Content-Type: text/html; charset=UTF-8

<html><body style="font-family:system-ui;padding:20px;">
  <p><strong>New sign-in detected</strong></p>
  <p>Device: Windows · Location: Localhost · IP: 127.0.0.1</p>
  <p style="color:#dc2626;">If this wasn't you, <a href="#">secure your account</a>.</p>
</body></html>
------=_DevNest_Boundary--
"@
        }
        @{
            From    = "mail@devnest-shop.test"
            To      = "team@example.test"
            Subject = "Weekly digest - 12 new orders"
            Body    = @"
MIME-Version: 1.0
Content-Type: text/html; charset=UTF-8

<!DOCTYPE html>
<html><body style="font-family:system-ui;background:#fafafa;padding:24px;">
  <div style="max-width:520px;margin:0 auto;background:#fff;border:1px solid #e5e7eb;border-radius:8px;padding:24px;">
    <h2 style="margin-top:0;">Weekly digest</h2>
    <p>Here's what happened this week:</p>
    <p style="font-size:28px;font-weight:bold;color:#111827;">12 orders</p>
    <p style="color:#6b7280;">Revenue: $1,842.50 · 3 new customers</p>
  </div>
</body></html>
"@
        }
    )
}

function Send-SmtpEmail {
    param(
        [string]$From,
        [string]$To,
        [string]$Subject,
        [string]$Body
    )

    $client = New-Object System.Net.Sockets.TcpClient("127.0.0.1", 1025)
    $stream = $client.GetStream()
    $writer = New-Object System.IO.StreamWriter($stream)
    $reader = New-Object System.IO.StreamReader($stream)
    $writer.AutoFlush = $true

    $readLine = { $line = $reader.ReadLine(); if ($line -and -not $Quiet) { Write-Host "< $line" -ForegroundColor DarkGray }; return $line }

    & $readLine | Out-Null
    $writer.WriteLine("EHLO localhost"); & $readLine | Out-Null
    $writer.WriteLine("MAIL FROM:<$From>"); & $readLine | Out-Null
    $writer.WriteLine("RCPT TO:<$To>"); & $readLine | Out-Null
    $writer.WriteLine("DATA"); & $readLine | Out-Null

    # Subject line first, then body (body may include its own MIME headers)
    $writer.WriteLine("Subject: $Subject")
    $writer.WriteLine("From: $From")
    $writer.WriteLine("To: $To")
    $writer.WriteLine("Date: $(Get-Date -Format 'ddd, dd MMM yyyy HH:mm:ss K')")
    $writer.WriteLine("X-Mailer: Laravel")
    $writer.WriteLine("X-DevNest-Test: true")
    $writer.WriteLine("")

    foreach ($line in ($Body -split "`r?`n")) {
        if ($line -eq ".") { $writer.WriteLine("..") } else { $writer.WriteLine($line) }
    }
    $writer.WriteLine(".")
    & $readLine | Out-Null
    $writer.WriteLine("QUIT")
    $client.Close()
}

# Verify SMTP is up
try {
    $probe = New-Object System.Net.Sockets.TcpClient
    $probe.Connect("127.0.0.1", 1025)
    $probe.Close()
} catch {
    Write-Host "ERROR: Nothing is listening on 127.0.0.1:1025" -ForegroundColor Red
    Write-Host "Start the daemon: .\scripts\dev.ps1" -ForegroundColor Yellow
    exit 1
}

if ($Count -lt 1) { $Count = 1 }

$templates = Get-LaravelMailTemplates
$sent = 0

for ($i = 0; $i -lt $Count; $i++) {
    $tpl = $templates[$i % $templates.Count]
    $suffix = if ($Count -gt $templates.Count) { " ($($i + 1))" } else { "" }

    $fromAddr = if ($tpl.From -match '<([^>]+)>') { $Matches[1] } else { $tpl.From }
    $toAddr = $tpl.To

    Send-SmtpEmail -From $fromAddr -To $toAddr -Subject "$($tpl.Subject)$suffix" -Body $tpl.Body
    $sent++
    Write-Log "  [$sent/$Count] $($tpl.Subject)" "DarkGray"

    if ($i -lt ($Count - 1)) { Start-Sleep -Milliseconds 50 }
}

Write-Log "`nSent $sent Laravel-style test email(s) to 127.0.0.1:1025 - check the Mail tab." "Green"
