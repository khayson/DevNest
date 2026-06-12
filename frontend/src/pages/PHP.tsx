import { motion } from "framer-motion"
import { Check, FileText, Folder, RefreshCw } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { sendCommand } from "../shared/api/ws"
import {
  formatPHPVersion,
  isPHPActive,
  usePHPStore,
  type PHPDirectives,
} from "../shared/store/php"
import { useTelemetryStore } from "../shared/store/telemetry"

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
    if (connected) {
      sendCommand("get_php")
    }
  }, [connected])

  const setActive = (path: string) => {
    sendCommand("set_active_php", { path })
  }

  const applyDirectives = () => {
    sendCommand("update_php_ini", { ...directives })
    setDirty(false)
  }

  const updateDirective = <K extends keyof PHPDirectives>(key: K, value: PHPDirectives[K]) => {
    setDirectives((prev) => ({ ...prev, [key]: value }))
    setDirty(true)
  }

  const noPHP = connected && sync && !sync.php_available

  return (
    <motion.div
      initial={{ opacity: 0, filter: "blur(4px)" }}
      animate={{ opacity: 1, filter: "blur(0px)" }}
      className="h-full flex flex-col min-h-0 space-y-6"
    >
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">PHP</h1>
        <p className="text-base text-zinc-500 dark:text-zinc-400">
          Manage PHP installations, switch the active runtime, and configure php.ini for local sites.
        </p>
      </div>

      <hr className="border-zinc-200 dark:border-zinc-800" />

      <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar min-h-0 space-y-6 pb-6">
        {noPHP && (
          <div className="rounded-lg border border-amber-200 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-950/20 px-4 py-3 text-sm text-amber-800 dark:text-amber-200">
            No PHP found on PATH or in <code className="font-mono text-xs">~/.devnest/runtimes/php</code>.
            Run <code className="font-mono text-xs">.\scripts\install-php.ps1</code> or install PHP manually, then restart the daemon.
          </div>
        )}

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-zinc-800 dark:text-zinc-200">Installed PHP Versions</h2>
            {phpRunning && sync?.cgi_port && (
              <span className="text-xs text-zinc-500 font-mono">php-cgi :{sync.cgi_port}</span>
            )}
          </div>

          <div className="border border-zinc-200 dark:border-zinc-800 rounded-lg bg-white dark:bg-zinc-900/50 overflow-hidden shadow-sm divide-y divide-zinc-200 dark:divide-zinc-800">
            {installations.length === 0 ? (
              <div className="p-5 text-sm text-zinc-500">
                {connected ? "Scanning for PHP installations…" : "Connect to the daemon to discover PHP."}
              </div>
            ) : (
              installations.map((phpInst) => {
                const activeInst = isPHPActive(phpInst, sync)
                const label = formatPHPVersion(phpInst)
                return (
                  <div
                    key={phpInst.binary}
                    className="flex items-center justify-between p-5 hover:bg-zinc-50/50 dark:hover:bg-zinc-800/10 transition-colors"
                  >
                    <div>
                      <div className="flex items-center space-x-2.5">
                        <span className="text-base font-bold text-zinc-800 dark:text-zinc-200">{label}</span>
                        {activeInst && (
                          <span className="bg-green-50 dark:bg-green-950/30 text-green-600 dark:text-green-400 border border-green-100 dark:border-green-900 px-2.5 py-1 rounded text-xs font-semibold">
                            Active
                          </span>
                        )}
                      </div>
                      <div
                        className="text-sm font-mono text-zinc-500 mt-1 max-w-lg truncate"
                        title={phpInst.binary}
                      >
                        {phpInst.binary}
                      </div>
                    </div>

                    <div className="flex items-center space-x-2.5">
                      <button
                        onClick={() => setActive(phpInst.binary)}
                        disabled={activeInst}
                        className={`px-3.5 py-2 text-xs font-semibold rounded-md border shadow-sm transition-all flex items-center space-x-1.5
                          ${
                            activeInst
                              ? "bg-zinc-50 dark:bg-zinc-800 text-zinc-400 border-zinc-200 dark:border-zinc-700 pointer-events-none"
                              : "bg-white hover:bg-zinc-50 dark:bg-zinc-800 dark:hover:bg-zinc-700/80 text-zinc-700 dark:text-zinc-200 border-zinc-300 dark:border-zinc-700"
                          }`}
                      >
                        {activeInst && <Check className="w-3.5 h-3.5 text-blue-500" />}
                        <span>{activeInst ? "Selected" : "Set Active"}</span>
                      </button>
                      {phpInst.ini_path && (
                        <button
                          className="p-2 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors"
                          title={phpInst.ini_path}
                        >
                          <FileText className="w-4.5 h-4.5" />
                        </button>
                      )}
                      <button
                        className="p-2 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors"
                        title="Open installation folder"
                      >
                        <Folder className="w-4.5 h-4.5" />
                      </button>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>

        <hr className="border-zinc-200 dark:border-zinc-800" />

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-zinc-800 dark:text-zinc-200">
              php.ini Directives ({active ? formatPHPVersion(active) : "Active PHP"})
            </h2>
            <button
              onClick={applyDirectives}
              disabled={!dirty || !active?.ini_path}
              className={`text-xs flex items-center space-x-1.5 font-medium transition-colors
                ${
                  dirty && active?.ini_path
                    ? "text-blue-600 dark:text-blue-400 hover:underline"
                    : "text-zinc-400 cursor-not-allowed"
                }`}
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Apply &amp; Reload PHP-CGI</span>
            </button>
          </div>

          {!active?.ini_path && sync?.php_available && (
            <p className="text-sm text-zinc-500">No php.ini found for the active installation.</p>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <label className="text-xs font-bold text-zinc-600 dark:text-zinc-400">memory_limit</label>
              <select
                value={directives.memory_limit}
                onChange={(e) => updateDirective("memory_limit", e.target.value)}
                disabled={!active?.ini_path}
                className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 rounded-md text-sm text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
              >
                <option value="128M">128M (Default)</option>
                <option value="256M">256M</option>
                <option value="512M">512M</option>
                <option value="1G">1G</option>
                <option value="2G">2G</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-zinc-600 dark:text-zinc-400">
                max_execution_time (seconds)
              </label>
              <select
                value={directives.max_execution_time}
                onChange={(e) => updateDirective("max_execution_time", e.target.value)}
                disabled={!active?.ini_path}
                className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 rounded-md text-sm text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
              >
                <option value="30">30 (Default)</option>
                <option value="60">60</option>
                <option value="120">120</option>
                <option value="300">300</option>
                <option value="600">600</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-zinc-600 dark:text-zinc-400">upload_max_filesize</label>
              <select
                value={directives.upload_max_filesize}
                onChange={(e) => updateDirective("upload_max_filesize", e.target.value)}
                disabled={!active?.ini_path}
                className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 rounded-md text-sm text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
              >
                <option value="2M">2M (Default)</option>
                <option value="10M">10M</option>
                <option value="20M">20M</option>
                <option value="50M">50M</option>
                <option value="100M">100M</option>
                <option value="500M">500M</option>
              </select>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  )
}
