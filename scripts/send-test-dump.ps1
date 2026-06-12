# Send Laravel VarDumper-style test dumps to the DevNest dump server (port 9912)
param(
    [int]$Count = 1,
    [switch]$Quiet
)

$ErrorActionPreference = "Stop"

function Write-Log {
    param([string]$Message, [string]$Color = "Gray")
    if (-not $Quiet) { Write-Host $Message -ForegroundColor $Color }
}

function Get-LaravelDumpTemplates {
    @(
        @{
            Label   = "string dump"
            Payload = @'
<pre class="sf-dump" id="sf-dump-1" data-indent-pad="  "><span class="sf-dump-note">dump()</span> "<span class="sf-dump-str" title="18 characters">User not found</span>"
</pre>
'@
        }
        @{
            Label   = "array dump"
            Payload = @'
<pre class="sf-dump" id="sf-dump-2"><span class="sf-dump-note">array:4</span> [<samp>
  "<span class="sf-dump-key">id</span>" => <span class="sf-dump-num">42</span>
  "<span class="sf-dump-key">name</span>" => "<span class="sf-dump-str" title="5 characters">Alice</span>"
  "<span class="sf-dump-key">email</span>" => "<span class="sf-dump-str" title="18 characters">alice@example.test</span>"
  "<span class="sf-dump-key">roles</span>" => <span class="sf-dump-note">array:2</span> [<samp>
    <span class="sf-dump-num">0</span> => "<span class="sf-dump-str">admin</span>"
    <span class="sf-dump-num">1</span> => "<span class="sf-dump-str">editor</span>"
  </samp>]
</samp>]</pre>
'@
        }
        @{
            Label   = "Eloquent model"
            Payload = @'
<pre class="sf-dump" id="sf-dump-3"><span class="sf-dump-note">App\Models\User</span> {<a class="sf-dump-ref">#1842</a><samp>
  #<span class="sf-dump-protected" title="Protected property">connection</span>: "<span class="sf-dump-str">mysql</span>"
  #<span class="sf-dump-protected">table</span>: "<span class="sf-dump-str">users</span>"
  #<span class="sf-dump-protected">primaryKey</span>: "<span class="sf-dump-str">id</span>"
  +<span class="sf-dump-public">incrementing</span>: <span class="sf-dump-const">true</span>
  #<span class="sf-dump-protected">attributes</span>: <span class="sf-dump-note">array:6</span> [<samp>
    "<span class="sf-dump-key">id</span>" => <span class="sf-dump-num">1</span>
    "<span class="sf-dump-key">name</span>" => "<span class="sf-dump-str">DevNest Admin</span>"
    "<span class="sf-dump-key">email</span>" => "<span class="sf-dump-str">admin@devnest-shop.test</span>"
    "<span class="sf-dump-key">email_verified_at</span>" => "<span class="sf-dump-str">2026-06-12T10:00:00.000000Z</span>"
    "<span class="sf-dump-key">created_at</span>" => "<span class="sf-dump-str">2026-01-15T08:30:00.000000Z</span>"
    "<span class="sf-dump-key">updated_at</span>" => "<span class="sf-dump-str">2026-06-12T09:15:00.000000Z</span>"
  </samp>]
  #<span class="sf-dump-protected">original</span>: <span class="sf-dump-note">array:6</span> [<span class="sf-dump-ellipsis">…</span>]
</samp>}</pre>
'@
        }
        @{
            Label   = "Collection"
            Payload = @'
<pre class="sf-dump" id="sf-dump-4"><span class="sf-dump-note">Illuminate\Support\Collection</span> {<a class="sf-dump-ref">#901</a><samp>
  #<span class="sf-dump-protected">items</span>: <span class="sf-dump-note">array:3</span> [<samp>
    <span class="sf-dump-num">0</span> => <span class="sf-dump-note">array:2</span> [<samp>
      "<span class="sf-dump-key">sku</span>" => "<span class="sf-dump-str">DN-HOODIE</span>"
      "<span class="sf-dump-key">qty</span>" => <span class="sf-dump-num">2</span>
    </samp>]
    <span class="sf-dump-num">1</span> => <span class="sf-dump-note">array:2</span> [<samp>
      "<span class="sf-dump-key">sku</span>" => "<span class="sf-dump-str">DN-MUG</span>"
      "<span class="sf-dump-key">qty</span>" => <span class="sf-dump-num">1</span>
    </samp>]
    <span class="sf-dump-num">2</span> => <span class="sf-dump-note">array:2</span> [<samp>
      "<span class="sf-dump-key">sku</span>" => "<span class="sf-dump-str">DN-STICKER</span>"
      "<span class="sf-dump-key">qty</span>" => <span class="sf-dump-num">5</span>
    </samp>]
  </samp>]
</samp>}</pre>
'@
        }
        @{
            Label   = "dd() multi-var"
            Payload = @'
<pre class="sf-dump" id="sf-dump-5"><span class="sf-dump-note">dd()</span> <span class="sf-dump-const">null</span>
</pre><pre class="sf-dump" id="sf-dump-6"><span class="sf-dump-note">array:2</span> [<samp>
  "<span class="sf-dump-key">request</span>" => <span class="sf-dump-note">Illuminate\Http\Request</span> {<a class="sf-dump-ref">#42</a><span class="sf-dump-ellipsis">…</span>}
  "<span class="sf-dump-key">user</span>" => <span class="sf-dump-const">null</span>
</samp>]</pre>
'@
        }
        @{
            Label   = "ValidationException"
            Payload = @'
<pre class="sf-dump" id="sf-dump-7"><span class="sf-dump-note">Illuminate\Validation\ValidationException</span> {<a class="sf-dump-ref">#1204</a><samp>
  #<span class="sf-dump-protected">message</span>: "<span class="sf-dump-str">The email field must be a valid email address. (and 1 more error)</span>"
  #<span class="sf-dump-protected">code</span>: <span class="sf-dump-num">0</span>
  #<span class="sf-dump-protected">file</span>: "<span class="sf-dump-str">vendor/laravel/framework/src/Illuminate/Validation/Validator.php</span>"
  #<span class="sf-dump-protected">line</span>: <span class="sf-dump-num">515</span>
  -<span class="sf-dump-private">errors</span>: <span class="sf-dump-note">Illuminate\Support\MessageBag</span> {<a class="sf-dump-ref">#1205</a><samp>
    #<span class="sf-dump-protected">messages</span>: <span class="sf-dump-note">array:2</span> [<samp>
      "<span class="sf-dump-key">email</span>" => <span class="sf-dump-note">array:1</span> [<span class="sf-dump-ellipsis">…</span>]
      "<span class="sf-dump-key">password</span>" => <span class="sf-dump-note">array:1</span> [<span class="sf-dump-ellipsis">…</span>]
    </samp>]
  </samp>}
</samp>}</pre>
'@
        }
        @{
            Label   = "Query builder"
            Payload = @'
<pre class="sf-dump" id="sf-dump-8"><span class="sf-dump-note">Illuminate\Database\Eloquent\Builder</span> {<a class="sf-dump-ref">#612</a><samp>
  +<span class="sf-dump-public">model</span>: <span class="sf-dump-note">App\Models\Order</span> {<a class="sf-dump-ref">#611</a><span class="sf-dump-ellipsis">…</span>}
  #<span class="sf-dump-protected">query</span>: <span class="sf-dump-note">Illuminate\Database\Query\Builder</span> {<a class="sf-dump-ref">#610</a><samp>
    #<span class="sf-dump-protected">connection</span>: <span class="sf-dump-note">Illuminate\Database\MySqlConnection</span> {<span class="sf-dump-ellipsis">…</span>}
    #<span class="sf-dump-protected">grammar</span>: <span class="sf-dump-note">Illuminate\Database\Query\Grammars\MySqlGrammar</span> {<span class="sf-dump-ellipsis">…</span>}
    #<span class="sf-dump-protected">bindings</span>: <span class="sf-dump-note">array:3</span> [<span class="sf-dump-ellipsis">…</span>]
  </samp>}
</samp>}</pre>
<script>Sfdump("sf-dump-8")</script>
'@
        }
        @{
            Label   = "JSON API response"
            Payload = @'
<pre class="sf-dump" id="sf-dump-9"><span class="sf-dump-note">array:3</span> [<samp>
  "<span class="sf-dump-key">data</span>" => <span class="sf-dump-note">array:2</span> [<samp>
    "<span class="sf-dump-key">id</span>" => <span class="sf-dump-num">99</span>
    "<span class="sf-dump-key">type</span>" => "<span class="sf-dump-str">orders</span>"
  </samp>]
  "<span class="sf-dump-key">meta</span>" => <span class="sf-dump-note">array:1</span> [<samp>
    "<span class="sf-dump-key">total</span>" => <span class="sf-dump-num">142</span>
  </samp>]
  "<span class="sf-dump-key">links</span>" => <span class="sf-dump-note">array:2</span> [<span class="sf-dump-ellipsis">…</span>]
</samp>]</pre>
'@
        }
    )
}

function Send-DumpPayload {
    param([string]$Payload)

    $client = New-Object System.Net.Sockets.TcpClient("127.0.0.1", 9912)
    $stream = $client.GetStream()
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($Payload)
    $stream.Write($bytes, 0, $bytes.Length)
    $stream.Flush()
    $client.Client.Shutdown([System.Net.Sockets.SocketShutdown]::Send)
    Start-Sleep -Milliseconds 80
    $client.Close()
    return $bytes.Length
}

try {
    $probe = New-Object System.Net.Sockets.TcpClient
    $probe.Connect("127.0.0.1", 9912)
    $probe.Close()
} catch {
    Write-Host "ERROR: Nothing is listening on 127.0.0.1:9912" -ForegroundColor Red
    Write-Host "Start the daemon: .\scripts\dev.ps1" -ForegroundColor Yellow
    exit 1
}

if ($Count -lt 1) { $Count = 1 }

$templates = Get-LaravelDumpTemplates
$sent = 0
$totalBytes = 0

for ($i = 0; $i -lt $Count; $i++) {
    $tpl = $templates[$i % $templates.Count]
    $bytes = Send-DumpPayload -Payload $tpl.Payload
    $sent++
    $totalBytes += $bytes
    Write-Log "  [$sent/$Count] $($tpl.Label) ($bytes bytes)" "DarkGray"

    if ($i -lt ($Count - 1)) { Start-Sleep -Milliseconds 80 }
}

Write-Log "`nSent $sent dump(s) ($totalBytes bytes total) to 127.0.0.1:9912 - check Dumps tab (Sync if needed)." "Green"
