import { motion } from "framer-motion"
import { Play, Square as Stop, RefreshCw } from "lucide-react"
import { useTelemetryStore } from "../shared/store/telemetry"
import { sendCommand } from "../shared/api/ws"
import { startServiceWithFeedback } from "../shared/lib/service-actions"
import { notify } from "../shared/store/notifications"
import { LIVE_SERVICES, countRunningServices, getServiceBrandStyle } from "@/shared/lib/live-services"
import { cn } from "@/shared/lib/utils"

export function Services() {
  const rawServices = useTelemetryStore((state) => state.services) || {}
  const isConnected = useTelemetryStore((state) => state.isConnected)
  const runningCount = countRunningServices(rawServices)

  const services = LIVE_SERVICES.map((s) => {
    const metric = rawServices[s.id]
    const isRunning = metric?.state === "running"
    return { ...s, isRunning }
  })

  return (
    <motion.div 
      initial={{ opacity: 0, filter: "blur(4px)" }} 
      animate={{ opacity: 1, filter: "blur(0px)" }} 
      className="space-y-6 h-full flex flex-col min-h-0"
    >
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">Services</h1>
          <p className="text-base text-zinc-500 dark:text-zinc-400">
            {isConnected
              ? `${runningCount}/${LIVE_SERVICES.length} daemon services running`
              : "Manage live daemon services."}
          </p>
        </div>

        <div className="flex items-center space-x-2.5">
          <button 
            onClick={() => {
              if (sendCommand("start_all")) notify.info("Starting all services…", undefined, "service")
            }}
            disabled={!isConnected}
            className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:hover:bg-zinc-200 dark:text-zinc-950 text-xs font-semibold rounded-md shadow flex items-center space-x-2 transition-colors disabled:opacity-50"
          >
            <Play className="w-4 h-4 fill-current" />
            <span>Start All</span>
          </button>
          <button 
            onClick={() => {
              if (sendCommand("stop_all")) notify.info("Stopping all services…", undefined, "service")
            }}
            disabled={!isConnected}
            className="px-4 py-2 bg-white hover:bg-zinc-100 dark:bg-zinc-800 dark:hover:bg-zinc-700/80 text-zinc-800 dark:text-zinc-200 border border-zinc-300 dark:border-zinc-700 text-xs font-semibold rounded-md shadow flex items-center space-x-2 transition-colors disabled:opacity-50"
          >
            <Stop className="w-4 h-4" />
            <span>Stop All</span>
          </button>
        </div>
      </div>

      <hr className="border-zinc-200 dark:border-zinc-800" />

      <div className="flex-1 overflow-auto border border-zinc-200 dark:border-zinc-800 rounded-lg bg-white dark:bg-zinc-900/50 shadow-sm min-h-0 custom-scrollbar">
        <table className="w-full border-collapse text-left text-sm text-zinc-500 dark:text-zinc-400">
          <thead className="bg-zinc-50 dark:bg-zinc-900 text-[13px] font-semibold uppercase text-zinc-600 dark:text-zinc-400 border-b border-zinc-200 dark:border-zinc-800 sticky top-0">
            <tr>
              <th scope="col" className="px-6 py-4">Status</th>
              <th scope="col" className="px-6 py-4">Service</th>
              <th scope="col" className="px-6 py-4">Port</th>
              <th scope="col" className="px-6 py-4">Version</th>
              <th scope="col" className="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {services.map((service) => {
              const Icon = service.icon
              const brand = getServiceBrandStyle(service, service.isRunning)
              return (
              <tr key={service.id} className="hover:bg-zinc-50/55 dark:hover:bg-zinc-800/20 transition-colors">
                <td className="px-6 py-5">
                  <div className="flex items-center space-x-2.5">
                    <span className={`w-2.5 h-2.5 rounded-full ${service.isRunning ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)]' : 'bg-zinc-400'}`} />
                    <span className="text-sm font-semibold text-zinc-700 dark:text-zinc-400">
                      {service.isRunning ? "Running" : "Stopped"}
                    </span>
                  </div>
                </td>
                <td className="px-6 py-5">
                  <div className="flex items-center space-x-3">
                    <div
                      className={cn(
                        "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border transition-all",
                        brand.bg,
                        brand.border,
                        service.isRunning && service.brand.active.glow
                      )}
                    >
                      <Icon className={cn("h-[18px] w-[18px]", brand.icon)} strokeWidth={2.25} />
                    </div>
                    <div className="min-w-0">
                      <span className="font-bold text-zinc-800 dark:text-zinc-200 text-sm block">{service.name}</span>
                      <span className="text-xs text-zinc-400 dark:text-zinc-500 truncate block">{service.hint}</span>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-5 font-mono text-sm text-zinc-500">
                  {service.port}
                </td>
                <td className="px-6 py-5 text-sm text-zinc-500">
                  {service.version}
                </td>
                <td className="px-6 py-5 text-right">
                  <div className="flex items-center justify-end space-x-2">
                    <button 
                      onClick={() => startServiceWithFeedback(service.id)}
                      disabled={service.isRunning || !isConnected}
                      className="p-2 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 hover:text-green-600 dark:hover:text-green-400 transition-colors disabled:opacity-30 disabled:pointer-events-none"
                      title="Start Service"
                    >
                      <Play className="w-4.5 h-4.5" />
                    </button>
                    <button 
                      onClick={() => {
                        if (sendCommand("restart_service", { serviceId: service.id })) {
                          notify.info(`Restarting ${service.name}…`, undefined, "service")
                        }
                      }}
                      disabled={!service.isRunning || !isConnected}
                      className="p-2 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 hover:text-blue-600 dark:hover:text-blue-400 transition-colors disabled:opacity-30 disabled:pointer-events-none"
                      title="Restart Service"
                    >
                      <RefreshCw className="w-4.5 h-4.5" />
                    </button>
                    <button 
                      onClick={() => {
                        if (sendCommand("stop_service", { serviceId: service.id })) {
                          notify.info(`Stopping ${service.name}…`, undefined, "service")
                        }
                      }}
                      disabled={!service.isRunning || !isConnected}
                      className="p-2 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 hover:text-red-600 dark:hover:text-red-400 transition-colors disabled:opacity-30 disabled:pointer-events-none"
                      title="Stop Service"
                    >
                      <Stop className="w-4.5 h-4.5" />
                    </button>
                  </div>
                </td>
              </tr>
            )})}
          </tbody>
        </table>
      </div>
    </motion.div>
  )
}
