import { motion } from "framer-motion"
import { Play, Square as Stop, RefreshCw, Globe, Server, Database, Mail, Terminal } from "lucide-react"
import { useTelemetryStore } from "../shared/store/telemetry"
import { sendCommand } from "../shared/api/ws"

const getServiceIcon = (id: string) => {
  switch (id) {
    case "caddy": return <Globe className="w-4 h-4 text-blue-500" />
    case "php": return <Server className="w-4 h-4 text-indigo-500" />
    case "mysql": return <Database className="w-4 h-4 text-orange-500" />
    case "postgres": return <Database className="w-4 h-4 text-blue-400" />
    case "redis": return <Database className="w-4 h-4 text-red-500" />
    case "mail":
    case "embedded-mail-server": return <Mail className="w-4 h-4 text-green-500" />
    case "embedded-dump-server": return <Terminal className="w-4 h-4 text-pink-500" />
    case "dns": return <Globe className="w-4 h-4 text-cyan-500" />
    default: return <Server className="w-4 h-4 text-zinc-500" />
  }
}

export function Services() {
  const rawServices = useTelemetryStore((state) => state.services) || {}
  const isConnected = useTelemetryStore((state) => state.isConnected)

  const expectedServices = [
    { id: "caddy", name: "Caddy Web Server", version: "v2.8.4", port: "80, 443" },
    { id: "php", name: "PHP-FPM 8.3", version: "8.3.0", port: "9000" },
    { id: "mysql", name: "MySQL Server", version: "8.0", port: "3306" },
    { id: "postgres", name: "PostgreSQL", version: "16", port: "5432" },
    { id: "redis", name: "Redis", version: "7.2", port: "6379" },
    { id: "embedded-mail-server", name: "Mail Interceptor Server", version: "1.0.0", port: "1025" },
    { id: "embedded-dump-server", name: "Dump Server", version: "1.0.0", port: "9912" },
    { id: "dns", name: "Local DNS Resolver", version: "1.0", port: "53" },
  ]

  const services = expectedServices.map(s => {
    // Check if running by checking if we have metrics for it
    const metric = rawServices[s.id]
    const isRunning = metric !== undefined && (metric.MemoryBytes > 0 || metric.CpuPercent > 0)
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
          <p className="text-base text-zinc-500 dark:text-zinc-400">Manage individual binaries and server processes.</p>
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

      <hr className="border-zinc-200 dark:border-zinc-800" />

      {/* Services Table */}
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
            {services.map((service) => (
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
                    <div className="p-2 bg-zinc-100 dark:bg-zinc-850 rounded border border-zinc-200/50 dark:border-zinc-700/50">
                      {getServiceIcon(service.id)}
                    </div>
                    <span className="font-bold text-zinc-800 dark:text-zinc-200 text-sm">{service.name}</span>
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
                      onClick={() => sendCommand("start_service", { serviceId: service.id })}
                      disabled={service.isRunning || !isConnected}
                      className="p-2 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 hover:text-green-600 dark:hover:text-green-400 transition-colors disabled:opacity-30 disabled:pointer-events-none"
                      title="Start Service"
                    >
                      <Play className="w-4.5 h-4.5" />
                    </button>
                    <button 
                      onClick={() => sendCommand("restart_service", { serviceId: service.id })}
                      disabled={!service.isRunning || !isConnected}
                      className="p-2 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 hover:text-blue-600 dark:hover:text-blue-400 transition-colors disabled:opacity-30 disabled:pointer-events-none"
                      title="Restart Service"
                    >
                      <RefreshCw className="w-4.5 h-4.5" />
                    </button>
                    <button 
                      onClick={() => sendCommand("stop_service", { serviceId: service.id })}
                      disabled={!service.isRunning || !isConnected}
                      className="p-2 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 hover:text-red-600 dark:hover:text-red-400 transition-colors disabled:opacity-30 disabled:pointer-events-none"
                      title="Stop Service"
                    >
                      <Stop className="w-4.5 h-4.5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </motion.div>
  )
}
