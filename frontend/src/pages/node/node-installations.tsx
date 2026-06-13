import { Check } from "lucide-react"
import { isNodeActive, type NodeInstallation, type NodeSyncPayload } from "@/shared/store/node"
import { Badge } from "@/shared/ui/badge"
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

interface NodeInstallationsProps {
  installations: NodeInstallation[]
  sync: NodeSyncPayload | null
  connected: boolean
  onSetActive: (path: string) => void
}

export function NodeInstallations({
  installations,
  sync,
  connected,
  onSetActive,
}: NodeInstallationsProps) {
  return (
    <SettingsGroup
      title="Installed versions"
      description="DevNest discovers Node on PATH and via nvm-windows. The active version runs npm run dev for frontend sites."
    >
      {installations.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-muted-foreground">
          {connected ? "Scanning for Node.js…" : "Connect to the daemon to discover Node."}
        </p>
      ) : (
        <>
          <DesktopTableOnly>
            <ResponsiveTable minWidth={560} className="rounded-none border-0 shadow-none">
              <ResponsiveTableHead>
                <tr>
                  <th className="px-4 py-2.5">Version</th>
                  <th className="px-4 py-2.5">Binary</th>
                  <th className="px-4 py-2.5 text-right">Actions</th>
                </tr>
              </ResponsiveTableHead>
              <ResponsiveTableBody>
                {installations.map((inst) => {
                  const active = isNodeActive(inst, sync)
                  return (
                    <tr key={inst.binary} className={cn(active && "bg-primary/5")}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-foreground">{inst.label}</span>
                          {active && <Badge className="text-[10px]">Active</Badge>}
                        </div>
                      </td>
                      <td className="max-w-[16rem] truncate px-4 py-3 font-mono text-xs" title={inst.binary}>
                        {inst.binary}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button
                          type="button"
                          size="sm"
                          className="h-8"
                          disabled={!connected || active}
                          onClick={() => onSetActive(inst.binary)}
                        >
                          {active ? (
                            <>
                              <Check className="h-3.5 w-3.5" />
                              Active
                            </>
                          ) : (
                            "Use this"
                          )}
                        </Button>
                      </td>
                    </tr>
                  )
                })}
              </ResponsiveTableBody>
            </ResponsiveTable>
          </DesktopTableOnly>

          <MobileCardList className="p-4">
            {installations.map((inst) => {
              const active = isNodeActive(inst, sync)
              return (
                <MobileDataCard
                  key={inst.binary}
                  title={inst.label}
                  subtitle={inst.binary}
                  badge={active ? <Badge className="text-[10px]">Active</Badge> : undefined}
                  selected={active}
                  rows={[]}
                  actions={
                    <Button
                      type="button"
                      size="sm"
                      className="h-8"
                      disabled={!connected || active}
                      onClick={() => onSetActive(inst.binary)}
                    >
                      {active ? "Active" : "Use this"}
                    </Button>
                  }
                />
              )
            })}
          </MobileCardList>
        </>
      )}
    </SettingsGroup>
  )
}
