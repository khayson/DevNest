import { motion } from "framer-motion"
import { Play, Square as Stop, Check } from "lucide-react"
import { sendCommand } from "../shared/api/ws"
import { useTelemetryStore } from "../shared/store/telemetry"
import { useConfigStore } from "../shared/store/config"

export function General() {
  const isConnected = useTelemetryStore((state) => state.isConnected)
  const services = useTelemetryStore((state) => state.services) || {}
  const config = useConfigStore((state) => state.config)

  const launchOnStartup = config?.launch_on_startup ?? true
  const autoStartServices = config?.auto_start_services ?? true
  const theme = config?.theme ?? "system"

  const activeServicesCount = Object.values(services).filter(
    (m: any) => m && (m.MemoryBytes > 0 || m.CpuPercent > 0 || m.PID > 0)
  ).length

  const handleToggleLaunch = (val: boolean) => {
    sendCommand("update_settings", {
      launch_on_startup: val,
      auto_start_services: autoStartServices,
      theme: theme,
    })
  }

  const handleToggleAutoStart = (val: boolean) => {
    sendCommand("update_settings", {
      launch_on_startup: launchOnStartup,
      auto_start_services: val,
      theme: theme,
    })
  }

  const handleThemeChange = (newTheme: "system" | "light" | "dark") => {
    sendCommand("update_settings", {
      launch_on_startup: launchOnStartup,
      auto_start_services: autoStartServices,
      theme: newTheme,
    })
  }

  return (
    <motion.div 
      initial={{ opacity: 0, filter: "blur(4px)" }} 
      animate={{ opacity: 1, filter: "blur(0px)" }} 
      className="h-full flex flex-col min-h-0 space-y-6"
    >
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">General</h1>
        <p className="text-base text-zinc-500 dark:text-zinc-400">Configure global preferences and launch settings.</p>
      </div>

      <hr className="border-zinc-200 dark:border-zinc-800" />

      <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar min-h-0 space-y-8 pb-8">
        {/* Global Status Banner */}
        <div className={`p-5 rounded-lg border transition-all duration-300 flex items-center justify-between
          ${!isConnected 
            ? "bg-red-50/50 border-red-200/50 dark:bg-red-950/10 dark:border-red-900/20" 
            : activeServicesCount > 0 
              ? "bg-green-50/50 border-green-200/50 dark:bg-green-950/10 dark:border-green-900/20" 
              : "bg-zinc-50 dark:bg-zinc-900/50 border-zinc-200 dark:border-zinc-800"
          }`}
        >
          <div className="flex items-center space-x-3.5">
            <div className={`h-3 w-3 rounded-full transition-all duration-300
              ${!isConnected 
                ? "bg-red-500" 
                : activeServicesCount > 0 
                  ? "bg-green-500 animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.4)]" 
                  : "bg-zinc-400"
              }`} 
            />
            <div>
              <div className="font-bold text-base text-zinc-800 dark:text-zinc-200">
                {!isConnected 
                  ? "DevNest Daemon is Offline" 
                  : activeServicesCount > 0 
                    ? "Services are Running" 
                    : "Services are Idle / Stopped"
                }
              </div>
              <div className="text-sm text-zinc-500">
                {!isConnected 
                  ? "Attempting to reconnect to background daemon on 127.0.0.1:9090..." 
                  : `${activeServicesCount} services active (Caddy, DNS, SMTP, Dump, etc.)`
                }
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-2.5">
            <button 
              onClick={() => sendCommand("start_all")}
              disabled={!isConnected}
              className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:hover:bg-zinc-200 dark:text-zinc-950 text-xs font-semibold rounded-md shadow flex items-center space-x-2 transition-colors disabled:opacity-50"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>Start All</span>
            </button>
            <button 
              onClick={() => sendCommand("stop_all")}
              disabled={!isConnected}
              className="px-4 py-2 bg-white hover:bg-zinc-100 dark:bg-zinc-800 dark:hover:bg-zinc-700/80 text-zinc-800 dark:text-zinc-200 border border-zinc-300 dark:border-zinc-700 text-xs font-semibold rounded-md shadow flex items-center space-x-2 transition-colors disabled:opacity-50"
            >
              <Stop className="w-4 h-4" />
              <span>Stop All</span>
            </button>
          </div>
        </div>

        {/* Preferences Settings */}
        <div className="space-y-6">
          <div>
            <h2 className="text-base font-bold text-zinc-800 dark:text-zinc-200 mb-4">Startup Behavior</h2>
            <div className="space-y-4">
              <label className="flex items-start space-x-3.5 cursor-pointer group">
                <input 
                  type="checkbox"
                  checked={launchOnStartup}
                  onChange={(e) => handleToggleLaunch(e.target.checked)}
                  className="mt-1 rounded border-zinc-300 dark:border-zinc-700 text-blue-600 focus:ring-blue-500 bg-white dark:bg-zinc-800 h-4.5 w-4.5"
                />
                <div>
                  <span className="text-sm font-semibold text-zinc-850 dark:text-zinc-200">Automatically launch DevNest at login</span>
                  <p className="text-xs text-zinc-500 mt-0.5">Launches the DevNest control panel and background daemon when you boot your machine.</p>
                </div>
              </label>

              <label className="flex items-start space-x-3.5 cursor-pointer group">
                <input 
                  type="checkbox"
                  checked={autoStartServices}
                  onChange={(e) => handleToggleAutoStart(e.target.checked)}
                  className="mt-1 rounded border-zinc-300 dark:border-zinc-700 text-blue-600 focus:ring-blue-500 bg-white dark:bg-zinc-800 h-4.5 w-4.5"
                />
                <div>
                  <span className="text-sm font-semibold text-zinc-850 dark:text-zinc-200">Automatically start services on launch</span>
                  <p className="text-xs text-zinc-500 mt-0.5">Starts Caddy, PHP, MySQL, and other checked services as soon as the application opens.</p>
                </div>
              </label>
            </div>
          </div>

          <hr className="border-zinc-200 dark:border-zinc-800" />

          {/* Theme Settings */}
          <div>
            <h2 className="text-base font-bold text-zinc-800 dark:text-zinc-200 mb-2">Interface Theme</h2>
            <p className="text-xs text-zinc-500 mb-4">Choose how you want DevNest to look on your system.</p>
            
            <div className="grid grid-cols-3 gap-4 max-w-md">
              {(["system", "light", "dark"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => handleThemeChange(t)}
                  className={`py-4 px-5 rounded-lg border text-sm font-bold transition-all text-center flex flex-col items-center justify-center space-y-1.5
                    ${theme === t 
                      ? "border-blue-500 bg-blue-50/50 dark:bg-blue-950/20 text-blue-600 dark:text-blue-400" 
                      : "border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/50 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 text-zinc-700 dark:text-zinc-300"
                    }`}
                >
                  <span className="capitalize">{t}</span>
                  {theme === t && <Check className="w-4 h-4 text-blue-500" />}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  )
}
