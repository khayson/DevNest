import { motion } from "framer-motion"
import { Check, Plus, Folder, Terminal } from "lucide-react"
import { useState } from "react"

interface NodeVersion {
  version: string
  isActive: boolean
  isInstalled: boolean
}

export function Node() {
  const [nodeVersions, setNodeVersions] = useState<NodeVersion[]>([
    { version: "v22.2.0", isActive: true, isInstalled: true },
    { version: "v20.10.0", isActive: false, isInstalled: true },
    { version: "v18.16.0", isActive: false, isInstalled: true },
    { version: "v16.20.0", isActive: false, isInstalled: false },
  ])

  const setActiveVersion = (version: string) => {
    setNodeVersions(nodeVersions.map(v => v.isInstalled ? { ...v, isActive: v.version === version } : v))
  }

  const installVersion = (version: string) => {
    setNodeVersions(nodeVersions.map(v => v.version === version ? { ...v, isInstalled: true } : v))
  }

  return (
    <motion.div 
      initial={{ opacity: 0, filter: "blur(4px)" }} 
      animate={{ opacity: 1, filter: "blur(0px)" }} 
      className="h-full flex flex-col min-h-0 space-y-6"
    >
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">NodeJS</h1>
        <p className="text-base text-zinc-500 dark:text-zinc-400">Manage Node.js versions on your system using the embedded nvm.</p>
      </div>

      <hr className="border-zinc-200 dark:border-zinc-800" />

      <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar min-h-0 space-y-6 pb-6">
        {/* active node info banner */}
        <div className="p-4 bg-zinc-50 dark:bg-zinc-900/50 rounded-lg border border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="h-9 w-9 rounded-md bg-green-500/10 dark:bg-green-500/20 text-green-600 dark:text-green-400 flex items-center justify-center">
              <Terminal className="w-5 h-5" />
            </div>
            <div>
              <div className="font-semibold text-sm text-zinc-800 dark:text-zinc-200">
                Active CLI Node Version: {nodeVersions.find(v => v.isActive)?.version || "None"}
              </div>
              <div className="text-xs text-zinc-500">
                NVM PATH: C:\Users\VICTUS\.nvm
              </div>
            </div>
          </div>

          <button className="px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:hover:bg-zinc-200 dark:text-zinc-950 text-xs font-semibold rounded-md shadow flex items-center space-x-1.5 transition-colors">
            <Plus className="w-4 h-4" />
            <span>Install Version</span>
          </button>
        </div>

        {/* node version list */}
        <div className="border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-hidden shadow-sm bg-white dark:bg-zinc-900/50">
          <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {nodeVersions.map((node) => (
              <div key={node.version} className="flex items-center justify-between p-4 hover:bg-zinc-50/50 dark:hover:bg-zinc-800/10 transition-colors">
                <div className="flex items-center space-x-4">
                  <span className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">{node.version}</span>
                  {node.isActive && (
                    <span className="bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-900 px-2 py-0.5 rounded text-xs font-semibold">
                      Active
                    </span>
                  )}
                  {!node.isInstalled && (
                    <span className="bg-zinc-100 dark:bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded text-xs">
                      Not Installed
                    </span>
                  )}
                </div>

                <div className="flex items-center space-x-2">
                  {node.isInstalled ? (
                    <button 
                      onClick={() => setActiveVersion(node.version)}
                      disabled={node.isActive}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-md border shadow-sm transition-all flex items-center space-x-1
                        ${node.isActive 
                          ? "bg-zinc-50 dark:bg-zinc-800 text-zinc-400 border-zinc-200 dark:border-zinc-700 pointer-events-none" 
                          : "bg-white hover:bg-zinc-50 dark:bg-zinc-800 dark:hover:bg-zinc-700/80 text-zinc-700 dark:text-zinc-200 border-zinc-300 dark:border-zinc-700"
                        }`}
                    >
                      {node.isActive && <Check className="w-3.5 h-3.5" />}
                      <span>{node.isActive ? "Selected" : "Set Active"}</span>
                    </button>
                  ) : (
                    <button 
                      onClick={() => installVersion(node.version)}
                      className="px-3 py-1.5 text-xs font-semibold rounded-md bg-blue-600 hover:bg-blue-700 text-white shadow transition-colors"
                    >
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
      </div>
    </motion.div>
  )
}
