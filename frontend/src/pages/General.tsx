import { useEffect, useMemo, useState, type ReactNode } from "react"
import { motion } from "framer-motion"
import { GripVertical, RotateCcw } from "lucide-react"
import { sendCommand, applyTheme } from "@/shared/api/ws"
import { useTelemetryStore } from "@/shared/store/telemetry"
import { useConfigStore } from "@/shared/store/config"
import { PageLayout } from "@/shared/ui/page-layout"
import { SettingsGroup } from "@/shared/ui/settings-group"
import { Button } from "@/shared/ui/button"
import { ReorderableCard, ReorderableCardList } from "@/shared/ui/reorderable-card"
import {
  type GeneralCardId,
  DEFAULT_GENERAL_CARD_ORDER,
  loadGeneralCardOrder,
  saveGeneralCardOrder,
  GENERAL_CARD_LABELS,
} from "@/shared/lib/general-card-order"
import {
  StatusHero,
  ServiceRow,
  ThemePicker,
  StartupSettings,
  ConnectionPanel,
} from "@/pages/general/general-sections"
import { LIVE_SERVICES, countRunningServices } from "@/shared/lib/live-services"

export function General() {
  const isConnected = useTelemetryStore((s) => s.isConnected)
  const services = useTelemetryStore((s) => s.services)
  const cpuUsage = useTelemetryStore((s) => s.telemetry.cpuUsage)
  const memoryRss = useTelemetryStore((s) => s.telemetry.memoryRss)
  const config = useConfigStore((s) => s.config)
  const updateSettings = useConfigStore((s) => s.updateSettings)

  const [cardOrder, setCardOrder] = useState<GeneralCardId[]>(loadGeneralCardOrder)

  useEffect(() => {
    saveGeneralCardOrder(cardOrder)
  }, [cardOrder])

  const launchOnStartup = config?.launch_on_startup ?? true
  const autoStartServices = config?.auto_start_services ?? true
  const theme = config?.theme ?? "system"

  const runningCount = countRunningServices(services)

  const pushSettings = (patch: {
    launch_on_startup?: boolean
    auto_start_services?: boolean
    theme?: "system" | "light" | "dark"
  }) => {
    const next = {
      launch_on_startup: patch.launch_on_startup ?? launchOnStartup,
      auto_start_services: patch.auto_start_services ?? autoStartServices,
      theme: patch.theme ?? theme,
    }
    updateSettings(next)
    if (patch.theme) applyTheme(patch.theme)
    sendCommand("update_settings", next)
  }

  const cardContent = useMemo(
    (): Record<GeneralCardId, ReactNode> => ({
      services: (
        <SettingsGroup
          title="Live services"
          description="Mail trap, dump server, and DNS — wired to the Go daemon."
        >
          {LIVE_SERVICES.map((service) => (
            <ServiceRow
              key={service.id}
              service={service}
              isRunning={services[service.id]?.state === "running"}
              isConnected={isConnected}
            />
          ))}
        </SettingsGroup>
      ),
      startup: (
        <StartupSettings
          isConnected={isConnected}
          launchOnStartup={launchOnStartup}
          autoStartServices={autoStartServices}
          onLaunchChange={(v) => pushSettings({ launch_on_startup: v })}
          onAutoStartChange={(v) => pushSettings({ auto_start_services: v })}
        />
      ),
      appearance: (
        <SettingsGroup
          title="Appearance"
          description="Saved to ~/.devnest/devnest.json and applied immediately."
        >
          <ThemePicker
            theme={theme}
            disabled={!isConnected}
            onChange={(t) => pushSettings({ theme: t })}
          />
        </SettingsGroup>
      ),
      connection: <ConnectionPanel isConnected={isConnected} />,
    }),
    [
      isConnected,
      services,
      launchOnStartup,
      autoStartServices,
      theme,
    ]
  )

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18 }}
      className="h-full min-h-0 w-full"
    >
      <PageLayout>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            Daemon status, services, startup, and appearance.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <GripVertical className="h-3.5 w-3.5" />
              Drag cards to rearrange
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={() => setCardOrder([...DEFAULT_GENERAL_CARD_ORDER])}
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reset layout
            </Button>
          </div>
        </div>

        <StatusHero
          isConnected={isConnected}
          runningCount={runningCount}
          cpuUsage={cpuUsage}
          memoryRss={memoryRss}
        />

        <ReorderableCardList values={cardOrder} onReorder={setCardOrder}>
          {cardOrder.map((id) => (
            <ReorderableCard
              key={id}
              value={id}
              label={GENERAL_CARD_LABELS[id]}
            >
              {cardContent[id]}
            </ReorderableCard>
          ))}
        </ReorderableCardList>
      </PageLayout>
    </motion.div>
  )
}
