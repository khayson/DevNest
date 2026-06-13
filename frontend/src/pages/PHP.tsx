import { RefreshCw } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { syncPHP } from "@/shared/api/ws"
import { isPHPActive, usePHPStore, type PHPDirectives } from "@/shared/store/php"
import { useTelemetryStore } from "@/shared/store/telemetry"
import { PageLayout, PageGrid } from "@/shared/ui/page-layout"
import { Button } from "@/shared/ui/button"
import { PHPStatusCard } from "@/pages/php/php-status-card"
import { PHPInstallations } from "@/pages/php/php-installations"
import { PHPIniSettings } from "@/pages/php/php-ini-settings"
import { PHPExtensions } from "@/pages/php/php-extensions"

export function PHP() {
  const sync = usePHPStore((s) => s.sync)
  const connected = useTelemetryStore((s) => s.isConnected)
  const phpRunning = useTelemetryStore((s) => s.services["php"]?.state === "running")

  const installations = sync?.installations ?? []
  const active = useMemo(
    () => installations.find((inst) => isPHPActive(inst, sync)),
    [installations, sync]
  )

  const [directives, setDirectives] = useState<PHPDirectives>({
    memory_limit: "128M",
    max_execution_time: "30",
    upload_max_filesize: "2M",
  })
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    if (sync?.directives) {
      setDirectives(sync.directives)
      setDirty(false)
    }
  }, [sync?.directives, sync?.active_path])

  useEffect(() => {
    if (connected) syncPHP()
  }, [connected])

  const updateDirective = <K extends keyof PHPDirectives>(key: K, value: PHPDirectives[K]) => {
    setDirectives((prev) => ({ ...prev, [key]: value }))
    setDirty(true)
  }

  const noPHP = connected && sync && !sync.php_available

  return (
    <PageLayout>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-sm text-muted-foreground">
          Switch PHP versions, run php-cgi for Caddy, and tune common php.ini values for local Laravel sites.
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-9"
          disabled={!connected}
          onClick={() => syncPHP()}
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </Button>
      </div>

      {noPHP && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-200">
          No PHP found on PATH or in{" "}
          <code className="font-mono text-xs">~/.devnest/runtimes/php</code>. Run{" "}
          <code className="font-mono text-xs">.\scripts\install-php.ps1</code> or install PHP manually,
          then refresh.
        </div>
      )}

      <PHPStatusCard sync={sync} active={active} phpRunning={phpRunning} connected={connected} />

      <PageGrid className="lg:grid-cols-1 2xl:grid-cols-2">
        <PHPInstallations installations={installations} sync={sync} connected={connected} />
        <PHPIniSettings
          active={active}
          directives={directives}
          dirty={dirty}
          phpAvailable={Boolean(sync?.php_available)}
          onChange={updateDirective}
          onApplied={() => setDirty(false)}
        />
        <PHPExtensions
          active={active}
          extensions={sync?.extensions ?? []}
          connected={connected}
        />
      </PageGrid>
    </PageLayout>
  )
}
