import { useEffect, useState } from "react"
import { Bot, Cloud, Copy, Check, ExternalLink, Rocket, RefreshCw, Link2 } from "lucide-react"
import { forgeDeploy, forgeListSites, linkForgeSite, updateForge } from "@/shared/api/ws"
import { useConfigStore } from "@/shared/store/config"
import { useSitesStore } from "@/shared/store/sites"
import { notify } from "@/shared/store/notifications"
import { copyToClipboard } from "@/shared/lib/mail"
import { MCP_CURSOR_CONFIG, MCP_HTTP_ENDPOINT, API_INFO_ENDPOINT } from "@/shared/lib/live-services"
import { Button } from "@/shared/ui/button"
import { Input } from "@/shared/ui/input"
import { SettingsGroup, SettingsRow } from "@/shared/ui/settings-group"
import { Badge } from "@/shared/ui/badge"
import { cn } from "@/shared/lib/utils"

function CopyBlock({ value, label }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <div className="space-y-1.5">
      {label && <p className="text-[11px] font-medium text-muted-foreground">{label}</p>}
      <div className="flex gap-2">
        <pre className="max-h-40 flex-1 overflow-auto rounded-md border border-border bg-muted/50 p-2.5 text-[11px] leading-relaxed text-foreground">
          {value}
        </pre>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="h-8 w-8 shrink-0"
          onClick={async () => {
            await copyToClipboard(value)
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
          }}
        >
          {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
        </Button>
      </div>
    </div>
  )
}

export function ForgePanel({ isConnected }: { isConnected?: boolean }) {
  const config = useConfigStore((s) => s.config)
  const forgeSites = useConfigStore((s) => s.forgeSites)
  const localSites = useSitesStore((s) => s.sites)
  const [token, setToken] = useState("")
  const [serverId, setServerId] = useState("")
  const [serverName, setServerName] = useState("")
  const [forgeSiteId, setForgeSiteId] = useState("")
  const [linkDomain, setLinkDomain] = useState("")

  useEffect(() => {
    const f = config?.forge
    if (f) {
      setToken(f.api_token ?? "")
      setServerId(f.server_id ? String(f.server_id) : "")
      setServerName(f.server_name ?? "")
    }
  }, [config?.forge])

  useEffect(() => {
    if (isConnected && config?.forge?.api_token && config?.forge?.server_id) {
      forgeListSites()
    }
  }, [isConnected, config?.forge?.api_token, config?.forge?.server_id])

  const save = () => {
    if (
      updateForge({
        api_token: token,
        server_id: serverId ? parseInt(serverId, 10) : undefined,
        server_name: serverName,
      })
    ) {
      notify.success("Forge saved", "API credentials stored in ~/.devnest/devnest.json", "system")
    }
  }

  const deploy = () => {
    const id = parseInt(forgeSiteId, 10)
    if (!id) {
      notify.error("Site ID required", "Enter the Forge site ID to deploy.", "system")
      return
    }
    if (forgeDeploy(id)) {
      notify.toast("Deploying…", "Triggering Forge deployment", "info")
    }
  }

  return (
    <SettingsGroup
      title="Laravel Forge"
      description="Link local sites to Forge for one-click deployments."
    >
      <SettingsRow label="API token" description="From forge.laravel.com → Profile → API">
        <Input
          type="password"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder="forge_…"
          className="max-w-xs font-mono text-xs"
          disabled={!isConnected}
        />
      </SettingsRow>
      <SettingsRow label="Server ID" description="Numeric ID of your Forge server">
        <div className="flex flex-wrap gap-2">
          <Input
            value={serverId}
            onChange={(e) => setServerId(e.target.value)}
            placeholder="123456"
            className="w-28 font-mono text-xs"
            disabled={!isConnected}
          />
          <Input
            value={serverName}
            onChange={(e) => setServerName(e.target.value)}
            placeholder="Label (optional)"
            className="max-w-[10rem] text-xs"
            disabled={!isConnected}
          />
        </div>
      </SettingsRow>
      <SettingsRow label="Deploy site" description="Forge site ID from the Forge dashboard URL">
        <div className="flex flex-wrap gap-2">
          <Input
            value={forgeSiteId}
            onChange={(e) => setForgeSiteId(e.target.value)}
            placeholder="Site ID"
            className="w-28 font-mono text-xs"
            disabled={!isConnected}
          />
          <Button type="button" size="sm" variant="secondary" disabled={!isConnected} onClick={deploy}>
            <Rocket className="h-3.5 w-3.5" />
            Deploy now
          </Button>
        </div>
      </SettingsRow>
      <div className="border-t border-border px-5 py-3">
        <Button type="button" size="sm" disabled={!isConnected} onClick={save}>
          <Cloud className="h-3.5 w-3.5" />
          Save Forge settings
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="ml-2"
          disabled={!isConnected || !token}
          onClick={() => forgeListSites()}
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Refresh sites
        </Button>
      </div>

      {forgeSites.length > 0 && (
        <div className="space-y-3 border-t border-border px-5 py-4">
          <p className="text-xs font-medium text-muted-foreground">Forge sites on this server</p>
          <ul className="max-h-48 space-y-2 overflow-auto text-xs">
            {forgeSites.map((site) => (
              <li
                key={site.id}
                className="flex items-center justify-between gap-2 rounded-md border border-border bg-muted/30 px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{site.name}</p>
                  <p className="truncate font-mono text-[10px] text-muted-foreground">{site.directory}</p>
                </div>
                <Badge variant="outline" className="shrink-0 font-mono">
                  #{site.id}
                </Badge>
              </li>
            ))}
          </ul>
          <SettingsRow label="Link to local site" description="Connect a Forge site ID to a *.test domain">
            <div className="flex flex-wrap gap-2">
              <select
                value={linkDomain}
                onChange={(e) => setLinkDomain(e.target.value)}
                className="h-9 rounded-md border border-border bg-background px-2 text-xs"
                disabled={!isConnected}
              >
                <option value="">Local site…</option>
                {localSites.map((s) => (
                  <option key={s.domain} value={s.domain}>
                    {s.domain}
                  </option>
                ))}
              </select>
              <select
                value={forgeSiteId}
                onChange={(e) => setForgeSiteId(e.target.value)}
                className="h-9 rounded-md border border-border bg-background px-2 text-xs"
                disabled={!isConnected}
              >
                <option value="">Forge site…</option>
                {forgeSites.map((s) => (
                  <option key={s.id} value={String(s.id)}>
                    {s.name} (#{s.id})
                  </option>
                ))}
              </select>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={!isConnected || !linkDomain || !forgeSiteId}
                onClick={() => {
                  if (linkForgeSite(linkDomain, parseInt(forgeSiteId, 10))) {
                    notify.success("Linked", `${linkDomain} → Forge #${forgeSiteId}`, "system")
                  }
                }}
              >
                <Link2 className="h-3.5 w-3.5" />
                Link
              </Button>
            </div>
          </SettingsRow>
        </div>
      )}
    </SettingsGroup>
  )
}

export function MCPPanel({ isConnected }: { isConnected?: boolean }) {
  const daemonOk = isConnected ?? false

  return (
    <SettingsGroup
      title="AI & MCP"
      description="Connect Cursor, Claude Desktop, or custom agents to your local DevNest environment."
    >
      <div className="space-y-4 border-b border-border px-5 py-4">
        <div className="flex flex-wrap items-center gap-2">
          <Bot className="h-4 w-4 text-violet-500" />
          <span className="text-sm font-medium">Model Context Protocol</span>
          <Badge variant={daemonOk ? "success" : "secondary"}>{daemonOk ? "Daemon online" : "Start daemon first"}</Badge>
        </div>
        <p className="text-xs leading-relaxed text-muted-foreground">
          DevNest exposes MCP tools so AI assistants can list sites, link projects, and start services.
          Use the <strong>stdio</strong> transport for Cursor (recommended) or the HTTP endpoint for scripts.
        </p>
      </div>

      <SettingsRow label="Cursor config" description="Add to .cursor/mcp.json in your project or user profile">
        <CopyBlock value={MCP_CURSOR_CONFIG} />
      </SettingsRow>

      <SettingsRow label="CLI (stdio)" description="Run manually to verify MCP responds">
        <CopyBlock value="devnest mcp" />
      </SettingsRow>

      <SettingsRow label="HTTP endpoint" description="JSON-RPC POST for custom integrations">
        <CopyBlock value={MCP_HTTP_ENDPOINT} />
      </SettingsRow>

      <SettingsRow label="API info" description="Discovery JSON with MCP + service URLs">
        <div className="flex flex-wrap items-center gap-2">
          <code className="rounded-md border border-border bg-muted/50 px-2 py-1 text-xs">{API_INFO_ENDPOINT}</code>
          <a
            href={API_INFO_ENDPOINT}
            target="_blank"
            rel="noreferrer"
            className={cn("inline-flex items-center gap-1 text-xs text-primary hover:underline", !daemonOk && "pointer-events-none opacity-50")}
          >
            Open
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </SettingsRow>

      <div className="border-t border-border px-5 py-3 text-[11px] text-muted-foreground">
        Available tools: <code className="text-foreground">list_sites</code>,{" "}
        <code className="text-foreground">link_site</code>,{" "}
        <code className="text-foreground">start_service</code>
      </div>
    </SettingsGroup>
  )
}

export function IntegrationsPanel({ isConnected }: { isConnected?: boolean }) {
  return (
    <div className="divide-y divide-border">
      <MCPPanel isConnected={isConnected} />
      <ForgePanel isConnected={isConnected} />
    </div>
  )
}
