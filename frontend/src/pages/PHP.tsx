import { motion } from "framer-motion"
import { Check, Folder, FileText, RefreshCw } from "lucide-react"
import { useState } from "react"

interface PHPVersion {
  version: string
  isActive: boolean
  isInstalled: boolean
  path: string
}

export function PHP() {
  const [phpVersions, setPhpVersions] = useState<PHPVersion[]>([
    { version: "PHP 8.3", isActive: true, isInstalled: true, path: "C:\\Users\\VICTUS\\.devnest\\bin\\php\\php-8.3.0" },
    { version: "PHP 8.2", isActive: false, isInstalled: true, path: "C:\\Users\\VICTUS\\.devnest\\bin\\php\\php-8.2.1" },
    { version: "PHP 8.1", isActive: false, isInstalled: true, path: "C:\\Users\\VICTUS\\.devnest\\bin\\php\\php-8.1.12" },
    { version: "PHP 7.4", isActive: false, isInstalled: false, path: "" },
  ])

  const [memoryLimit, setMemoryLimit] = useState("512M")
  const [maxExecutionTime, setMaxExecutionTime] = useState("120")
  const [uploadMaxFilesize, setUploadMaxFilesize] = useState("50M")

  const setPHPActive = (version: string) => {
    setPhpVersions(phpVersions.map(p => p.isInstalled ? { ...p, isActive: p.version === version } : p))
  }

  const activePhp = phpVersions.find(v => v.isActive)

  return (
    <motion.div 
      initial={{ opacity: 0, filter: "blur(4px)" }} 
      animate={{ opacity: 1, filter: "blur(0px)" }} 
      className="h-full flex flex-col min-h-0 space-y-6"
    >
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">PHP</h1>
        <p className="text-base text-zinc-500 dark:text-zinc-400">Manage PHP installations, switch active CLI versions, and configure php.ini parameters.</p>
      </div>

      <hr className="border-zinc-200 dark:border-zinc-800" />

      <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar min-h-0 space-y-6 pb-6">
        {/* PHP Switcher Section */}
        <div className="space-y-4">
          <h2 className="text-base font-bold text-zinc-800 dark:text-zinc-200">Installed PHP Versions</h2>
          
          <div className="border border-zinc-200 dark:border-zinc-800 rounded-lg bg-white dark:bg-zinc-900/50 overflow-hidden shadow-sm divide-y divide-zinc-200 dark:divide-zinc-800">
            {phpVersions.map((php) => (
              <div key={php.version} className="flex items-center justify-between p-5 hover:bg-zinc-50/50 dark:hover:bg-zinc-800/10 transition-colors">
                <div>
                  <div className="flex items-center space-x-2.5">
                    <span className="text-base font-bold text-zinc-800 dark:text-zinc-200">{php.version}</span>
                    {php.isActive && (
                      <span className="bg-green-50 dark:bg-green-950/30 text-green-600 dark:text-green-400 border border-green-100 dark:border-green-900 px-2.5 py-1 rounded text-xs font-semibold">
                        Active
                      </span>
                    )}
                  </div>
                  {php.isInstalled ? (
                    <div className="text-sm font-mono text-zinc-500 mt-1 max-w-sm truncate" title={php.path}>
                      {php.path}
                    </div>
                  ) : (
                    <div className="text-sm text-zinc-400 mt-1">Available for download</div>
                  )}
                </div>

                <div className="flex items-center space-x-2.5">
                  {php.isInstalled ? (
                    <>
                      <button 
                        onClick={() => setPHPActive(php.version)}
                        disabled={php.isActive}
                        className={`px-3.5 py-2 text-xs font-semibold rounded-md border shadow-sm transition-all flex items-center space-x-1.5
                          ${php.isActive 
                            ? "bg-zinc-50 dark:bg-zinc-800 text-zinc-400 border-zinc-200 dark:border-zinc-700 pointer-events-none" 
                            : "bg-white hover:bg-zinc-50 dark:bg-zinc-800 dark:hover:bg-zinc-700/80 text-zinc-700 dark:text-zinc-200 border-zinc-300 dark:border-zinc-700"
                          }`}
                      >
                        {php.isActive && <Check className="w-3.5 h-3.5 text-blue-500" />}
                        <span>{php.isActive ? "Selected" : "Set Active"}</span>
                      </button>
                      <button 
                        className="p-2 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors"
                        title="Open php.ini Configuration File"
                      >
                        <FileText className="w-4.5 h-4.5" />
                      </button>
                    </>
                  ) : (
                    <button className="px-3.5 py-2 text-xs font-semibold rounded-md bg-blue-600 hover:bg-blue-700 text-white shadow transition-colors">
                      Install
                    </button>
                  )}
                  <button 
                    className="p-2 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors"
                    title="Open Installation Folder"
                  >
                    <Folder className="w-4.5 h-4.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <hr className="border-zinc-200 dark:border-zinc-800" />

        {/* php.ini Quick Config */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-zinc-800 dark:text-zinc-200">php.ini Directives ({activePhp?.version || "Active PHP"})</h2>
            <button className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center space-x-1.5 font-medium">
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Apply & Reload PHP-FPM</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <label className="text-xs font-bold text-zinc-600 dark:text-zinc-400">memory_limit</label>
              <select 
                value={memoryLimit} 
                onChange={(e) => setMemoryLimit(e.target.value)}
                className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 rounded-md text-sm text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="128M">128M (Default)</option>
                <option value="256M">256M</option>
                <option value="512M">512M</option>
                <option value="1G">1G</option>
                <option value="2G">2G</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-zinc-600 dark:text-zinc-400">max_execution_time (seconds)</label>
              <select 
                value={maxExecutionTime} 
                onChange={(e) => setMaxExecutionTime(e.target.value)}
                className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 rounded-md text-sm text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
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
                value={uploadMaxFilesize} 
                onChange={(e) => setUploadMaxFilesize(e.target.value)}
                className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 rounded-md text-sm text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
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
