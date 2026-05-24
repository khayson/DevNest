import { motion } from "framer-motion"
import { Terminal, Trash2, RefreshCw } from "lucide-react"
import { useState } from "react"

export function Logs() {
  const [selectedService, setSelectedService] = useState("system")
  const [logLines, setLogLines] = useState<Record<string, string[]>>({
    system: [
      "[INFO] 09:42:00 - DevNest Daemon started on 127.0.0.1:9090",
      "[INFO] 09:42:02 - Loaded virtual hosts configuration successfully",
      "[INFO] 09:42:03 - Local DNS Resolver successfully bound to port 53",
      "[INFO] 09:42:03 - SMTP Mail Interceptor listening on port 1025",
      "[INFO] 09:42:04 - Dump Server listening on port 9912",
      "[INFO] 09:42:05 - Connection pool established to local SQLite store",
    ],
    caddy: [
      "2026/05/23 09:42:00 [INFO] caddy version: v2.8.4",
      "2026/05/23 09:42:01 [INFO] admin: admin server listening on 127.0.0.1:2019",
      "2026/05/23 09:42:02 [INFO] http: server listening on 127.0.0.1:80",
      "2026/05/23 09:42:02 [INFO] https: server listening on 127.0.0.1:443",
      "2026/05/23 09:42:02 [INFO] tls: loaded certificate for http://devnest-app.test",
    ],
    php: [
      "[23-May-2026 09:42:00] NOTICE: fpm is running, pid 31499",
      "[23-May-2026 09:42:00] NOTICE: ready to handle connections",
      "[23-May-2026 09:45:12] NOTICE: pool web connection accepted",
    ],
    mysql: [
      "2026-05-23T09:42:00.672Z 0 [System] [MY-010116] [Server] C:\\Users\\VICTUS\\.devnest\\bin\\mysql\\bin\\mysqld.exe: ready for connections.",
      "2026-05-23T09:42:01.001Z 0 [System] [MY-011323] [Server] X Plugin ready for connections on 127.0.0.1:33060",
    ]
  })

  const currentLogs = logLines[selectedService] || []

  const clearLogs = () => {
    setLogLines({ ...logLines, [selectedService]: [] })
  }

  return (
    <motion.div 
      initial={{ opacity: 0, filter: "blur(4px)" }} 
      animate={{ opacity: 1, filter: "blur(0px)" }} 
      className="h-full flex flex-col min-h-0 space-y-6"
    >
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">Logs</h1>
          <p className="text-base text-zinc-500 dark:text-zinc-400">View live log streams from DevNest services and virtual host processes.</p>
        </div>

        <div className="flex items-center space-x-2">
          <select
            value={selectedService}
            onChange={(e) => setSelectedService(e.target.value)}
            className="px-2.5 py-1.5 border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 rounded-md text-xs font-semibold text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="system">DevNest System</option>
            <option value="caddy">Caddy Web Server</option>
            <option value="php">PHP-FPM</option>
            <option value="mysql">MySQL Server</option>
          </select>

          {currentLogs.length > 0 && (
            <button 
              onClick={clearLogs}
              className="p-1.5 border border-zinc-200 dark:border-zinc-800 bg-white hover:bg-zinc-50 dark:bg-zinc-900 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400 rounded-md shadow-sm transition-colors"
              title="Clear Console Output"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      <hr className="border-zinc-200 dark:border-zinc-800" />

      {/* Terminal Pane */}
      <div className="flex-1 flex flex-col border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-hidden bg-zinc-950 font-mono text-[11px] leading-relaxed shadow-sm min-h-0">
        <div className="px-4 py-2 bg-zinc-900 border-b border-zinc-850/80 flex items-center justify-between">
          <div className="flex items-center space-x-2 text-zinc-400">
            <Terminal className="w-3.5 h-3.5" />
            <span>log_output_{selectedService}.log</span>
          </div>
          <div className="text-zinc-500 flex items-center space-x-1">
            <RefreshCw className="w-3 h-3 animate-spin" />
            <span>Streaming</span>
          </div>
        </div>

        <div className="flex-1 overflow-auto p-4 text-zinc-300 custom-scrollbar whitespace-pre-wrap select-text">
          {currentLogs.length === 0 ? (
            <div className="text-zinc-500 italic">No log statements recorded for this session.</div>
          ) : (
            currentLogs.map((line, idx) => (
              <div 
                key={idx} 
                className={`py-0.5 ${
                  line.includes("[ERROR]") || line.includes("error") 
                    ? "text-red-400" 
                    : line.includes("[WARNING]") 
                      ? "text-yellow-400" 
                      : "text-zinc-350"
                }`}
              >
                {line}
              </div>
            ))
          )}
        </div>
      </div>
    </motion.div>
  )
}
