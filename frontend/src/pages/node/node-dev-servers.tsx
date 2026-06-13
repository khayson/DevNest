import { AlertCircle, Play, RefreshCw, Square as Stop } from "lucide-react"
import type { NodeDevServer } from "@/shared/store/node"
import { Button } from "@/shared/ui/button"
import {
  DesktopTableOnly,
  MobileCardList,
  MobileDataCard,
  ResponsiveTable,
  ResponsiveTableBody,
  ResponsiveTableHead,
} from "@/shared/ui/responsive-table"
import { SettingsGroup } from "@/shared/ui/settings-group"
import { cn } from "@/shared/lib/utils"

interface NodeDevServersProps {
  servers: NodeDevServer[]
  connected: boolean
  nodeAvailable: boolean
  isRunning: (serviceId: string) => boolean
  onStart: (domain: string) => void
  onStop: (domain: string) => void
  onRestart: (domain: string) => void
  selectedDomain: string | null
  onSelectDomain: (domain: string) => void
}

export function NodeDevServers({
  servers,
  connected,
  nodeAvailable,
  isRunning,
  onStart,
  onStop,
  onRestart,
  selectedDomain,
  onSelectDomain,
}: NodeDevServersProps) {
  return (
    <SettingsGroup
      title="Dev servers"
      description="Sites with a package.json dev script. DevNest supervises npm run dev and proxies via Caddy."
    >
      <DesktopTableOnly>
        <ResponsiveTable minWidth={560} className="rounded-none border-0 shadow-none">
          <ResponsiveTableHead>
            <tr>
              <th className="px-4 py-2.5">Status</th>
              <th className="px-4 py-2.5">Site</th>
              <th className="px-4 py-2.5">Port</th>
              <th className="px-4 py-2.5 text-right">Actions</th>
            </tr>
          </ResponsiveTableHead>
          <ResponsiveTableBody>
            {servers.map((s) => {
              const running = isRunning(s.service_id)
              return (
                <tr
                  key={s.domain}
                  onClick={() => onSelectDomain(s.domain)}
                  className={cn(
                    "cursor-pointer hover:bg-muted/30",
                    selectedDomain === s.domain && "bg-primary/5"
                  )}
                >
                  <td className="px-4 py-3 text-sm">
                    <span className={running ? "text-emerald-600" : "text-muted-foreground"}>
                      {running ? "Running" : "Stopped"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-semibold text-foreground">{s.site_name}</p>
                    <p className="font-mono text-xs text-muted-foreground">{s.dev_command}</p>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">{s.port}</td>
                  <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="flex justify-end gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        disabled={!connected || !nodeAvailable}
                        onClick={() => (running ? onStop(s.domain) : onStart(s.domain))}
                      >
                        {running ? (
                          <Stop className="h-4 w-4 text-destructive" />
                        ) : (
                          <Play className="h-4 w-4 text-emerald-600" />
                        )}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        disabled={!running || !connected}
                        onClick={() => onRestart(s.domain)}
                      >
                        <RefreshCw className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </ResponsiveTableBody>
        </ResponsiveTable>
      </DesktopTableOnly>

      <MobileCardList className="p-4">
        {servers.map((s) => {
          const running = isRunning(s.service_id)
          return (
            <MobileDataCard
              key={s.domain}
              title={s.site_name}
              subtitle={s.dev_command}
              selected={selectedDomain === s.domain}
              onSelect={() => onSelectDomain(s.domain)}
              badge={
                <span className={`text-xs font-semibold ${running ? "text-emerald-600" : "text-muted-foreground"}`}>
                  {running ? "Running" : "Stopped"}
                </span>
              }
              rows={[
                { label: "Port", value: String(s.port) },
                { label: "Vite", value: s.uses_vite ? "Yes" : "No" },
              ]}
              actions={
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8"
                    disabled={!connected || !nodeAvailable}
                    onClick={() => (running ? onStop(s.domain) : onStart(s.domain))}
                  >
                    {running ? <Stop className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                    {running ? "Stop" : "Start"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8"
                    disabled={!running || !connected}
                    onClick={() => onRestart(s.domain)}
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                  </Button>
                </div>
              }
            />
          )
        })}
      </MobileCardList>

      {nodeAvailable && servers.length === 0 && (
        <div className="flex items-start gap-2 px-5 py-4 text-sm text-muted-foreground">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            No sites with a <code className="font-mono text-xs">package.json</code> dev script. Add a frontend
            project in Sites.
          </span>
        </div>
      )}
    </SettingsGroup>
  )
}
