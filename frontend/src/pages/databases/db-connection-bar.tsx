import { ExternalLink, Play, Square, Copy, Check } from "lucide-react"
import { useState } from "react"
import { Button } from "@/shared/ui/button"
import { Badge } from "@/shared/ui/badge"
import { cn } from "@/shared/lib/utils"
import { engineLabel, type DbEngine } from "@/shared/lib/databases-ui"
import type { DBServiceInfo } from "@/shared/store/databases"
import { copyToClipboard } from "@/shared/lib/mail"

interface DbConnectionBarProps {
  engine: DbEngine
  activeServer?: DBServiceInfo | null
  serverRunning: boolean
  isConnected: boolean
  sqlitePath?: string
  onToggleServer: () => void
  onOpenTablePlus: () => void
}

export function DbConnectionBar({
  engine,
  activeServer,
  serverRunning,
  isConnected,
  sqlitePath,
  onToggleServer,
  onOpenTablePlus,
}: DbConnectionBarProps) {
  const [copied, setCopied] = useState(false)
  const connStr =
    engine === "sqlite" && sqlitePath
      ? `sqlite://${sqlitePath.replace(/\\/g, "/")}`
      : activeServer?.conn_str ?? ""

  const host = engine === "sqlite" ? "local file" : "127.0.0.1"
  const port = engine === "sqlite" ? "—" : String(activeServer?.port ?? "—")
  const user = engine === "sqlite" ? "—" : activeServer?.username ?? "—"

  return (
    <div className="shrink-0 border-b border-slate-800 bg-slate-900/95 px-3 py-2.5 sm:px-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <Badge className="bg-teal-600/20 text-teal-300 hover:bg-teal-600/20">
            {engineLabel(engine)}
          </Badge>
          {engine !== "sqlite" && (
            <Badge
              variant="outline"
              className={cn(
                "border-slate-700 font-normal",
                serverRunning ? "text-emerald-400" : "text-amber-400"
              )}
            >
              {serverRunning ? "Connected" : "Offline"}
            </Badge>
          )}
          {engine === "sqlite" && (
            <Badge variant="outline" className="border-slate-700 font-normal text-sky-400">
              Built-in browser
            </Badge>
          )}
        </div>

        <div className="grid flex-1 grid-cols-2 gap-x-4 gap-y-1 font-mono text-[10px] text-slate-400 sm:grid-cols-4 lg:max-w-xl">
          <span>
            Host <span className="text-slate-200">{host}</span>
          </span>
          <span>
            Port <span className="text-slate-200">{port}</span>
          </span>
          <span>
            User <span className="text-slate-200">{user}</span>
          </span>
          <span className="col-span-2 truncate sm:col-span-1" title={connStr}>
            URL <span className="text-slate-300">{connStr ? connStr.slice(0, 28) + (connStr.length > 28 ? "…" : "") : "—"}</span>
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {connStr && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-8 gap-1.5 text-[11px] text-slate-300 hover:bg-slate-800 hover:text-white"
              onClick={async () => {
                await copyToClipboard(connStr)
                setCopied(true)
                setTimeout(() => setCopied(false), 2000)
              }}
            >
              {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
              Copy URL
            </Button>
          )}
          {engine !== "sqlite" && activeServer?.available && (
            <>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="h-8 gap-1.5 bg-slate-800 text-[11px] text-slate-100 hover:bg-slate-700"
                disabled={!isConnected || !serverRunning}
                onClick={onOpenTablePlus}
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Open in TablePlus
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8 gap-1.5 border-slate-700 text-[11px] text-slate-300 hover:bg-slate-800"
                disabled={!isConnected}
                onClick={onToggleServer}
              >
                {serverRunning ? (
                  <>
                    <Square className="h-3 w-3" />
                    Stop
                  </>
                ) : (
                  <>
                    <Play className="h-3 w-3" />
                    Start
                  </>
                )}
              </Button>
            </>
          )}
          {engine === "sqlite" && sqlitePath && (
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="h-8 gap-1.5 bg-slate-800 text-[11px] text-slate-100 hover:bg-slate-700"
              disabled={!isConnected}
              onClick={onOpenTablePlus}
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Open in TablePlus
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
