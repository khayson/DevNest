import { Check, ExternalLink, FileText, FolderOpen } from "lucide-react"
import { openPath, setActivePHP } from "@/shared/api/ws"
import {
  formatPHPVersion,
  isPHPActive,
  type PHPInstallation,
  type PHPSyncPayload,
} from "@/shared/store/php"
import { Badge } from "@/shared/ui/badge"
import { Button } from "@/shared/ui/button"
import {
  MobileCardList,
  MobileDataCard,
  ResponsiveTable,
  ResponsiveTableBody,
  ResponsiveTableHead,
  DesktopTableOnly,
} from "@/shared/ui/responsive-table"
import { SettingsGroup } from "@/shared/ui/settings-group"
import { cn } from "@/shared/lib/utils"

function installFolder(binary: string) {
  const sep = binary.includes("\\") ? "\\" : "/"
  const idx = Math.max(binary.lastIndexOf(sep), 0)
  return idx > 0 ? binary.slice(0, idx) : binary
}

interface PHPInstallationsProps {
  installations: PHPInstallation[]
  sync: PHPSyncPayload | null
  connected: boolean
}

export function PHPInstallations({ installations, sync, connected }: PHPInstallationsProps) {
  return (
    <SettingsGroup
      title="Installed versions"
      description="DevNest discovers PHP on PATH and in ~/.devnest/runtimes/php. The active version powers Caddy, migrations, and queue workers."
    >
      {installations.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-muted-foreground">
          {connected ? "Scanning for PHP installations…" : "Connect to the daemon to discover PHP."}
        </p>
      ) : (
        <>
          <DesktopTableOnly>
            <ResponsiveTable minWidth={640} className="rounded-none border-0 shadow-none">
              <ResponsiveTableHead>
                <tr>
                  <th className="px-4 py-2.5">Version</th>
                  <th className="px-4 py-2.5">Binary</th>
                  <th className="px-4 py-2.5">php.ini</th>
                  <th className="px-4 py-2.5 text-right">Actions</th>
                </tr>
              </ResponsiveTableHead>
              <ResponsiveTableBody>
                {installations.map((inst) => {
                  const active = isPHPActive(inst, sync)
                  return (
                    <tr key={inst.binary} className={cn(active && "bg-primary/5")}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-foreground">{formatPHPVersion(inst)}</span>
                          {active && (
                            <Badge className="text-[10px]">Active</Badge>
                          )}
                        </div>
                      </td>
                      <td className="max-w-[14rem] truncate px-4 py-3 font-mono text-xs" title={inst.binary}>
                        {inst.binary}
                      </td>
                      <td className="max-w-[12rem] truncate px-4 py-3 font-mono text-xs text-muted-foreground" title={inst.ini_path || undefined}>
                        {inst.ini_path ? inst.ini_path.split(/[/\\]/).pop() : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            disabled={!inst.ini_path}
                            title="Open php.ini"
                            onClick={() => inst.ini_path && openPath(inst.ini_path)}
                          >
                            <FileText className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            title="Open folder"
                            onClick={() => openPath(installFolder(inst.binary))}
                          >
                            <FolderOpen className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            className="h-8"
                            disabled={!connected || active}
                            onClick={() => setActivePHP(inst.binary)}
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
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </ResponsiveTableBody>
            </ResponsiveTable>
          </DesktopTableOnly>

          <MobileCardList className="p-4">
            {installations.map((inst) => {
              const active = isPHPActive(inst, sync)
              return (
                <MobileDataCard
                  key={inst.binary}
                  title={formatPHPVersion(inst)}
                  subtitle={inst.binary}
                  badge={active ? <Badge className="text-[10px]">Active</Badge> : undefined}
                  selected={active}
                  rows={[
                    { label: "php.ini", value: inst.ini_path || "Not found", breakAll: true },
                    { label: "php-cgi", value: inst.cgi_path, breakAll: true },
                  ]}
                  actions={
                    <>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8"
                        disabled={!inst.ini_path}
                        onClick={() => inst.ini_path && openPath(inst.ini_path)}
                      >
                        <FileText className="h-3.5 w-3.5" />
                        ini
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8"
                        onClick={() => openPath(installFolder(inst.binary))}
                      >
                        <FolderOpen className="h-3.5 w-3.5" />
                        Folder
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        className="h-8"
                        disabled={!connected || active}
                        onClick={() => setActivePHP(inst.binary)}
                      >
                        {active ? "Active" : "Use this"}
                      </Button>
                    </>
                  }
                />
              )
            })}
          </MobileCardList>
        </>
      )}

      <div className="border-t border-border px-5 py-3">
        <a
          href="https://windows.php.net/download/"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          <ExternalLink className="h-3.5 w-3.5" />
          Download PHP for Windows
        </a>
      </div>
    </SettingsGroup>
  )
}
