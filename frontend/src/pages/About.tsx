import { motion } from "framer-motion"
import { ShieldCheck, Heart, RefreshCw, FolderOpen, Terminal, ArrowUpRight, Key, Shield } from "lucide-react"
import { useState } from "react"

export function About() {
  const [isChecking, setIsChecking] = useState(false)
  const [updateMessage, setUpdateMessage] = useState("DevNest is up to date")

  const handleCheckUpdates = () => {
    setIsChecking(true)
    setUpdateMessage("Checking for updates...")
    setTimeout(() => {
      setIsChecking(false)
      setUpdateMessage("DevNest is up to date (Version 1.2.4)")
    }, 1500)
  }

  return (
    <motion.div 
      initial={{ opacity: 0, filter: "blur(4px)" }} 
      animate={{ opacity: 1, filter: "blur(0px)" }} 
      className="h-full flex flex-col min-h-0 space-y-6"
    >
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">About</h1>
          <p className="text-base text-zinc-500 dark:text-zinc-400">Information about the DevNest local environment manager, licenses, and components.</p>
        </div>
      </div>

      <hr className="border-zinc-200 dark:border-zinc-800" />

      <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar min-h-0 space-y-8 pb-8">

      {/* Hero Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 p-6 border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/50 rounded-xl shadow-sm">
        <div className="flex items-center space-x-5">
          <div className="h-20 w-20 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-4xl font-extrabold shadow-lg shadow-blue-500/10">
            D
          </div>
          <div>
            <h2 className="text-xl font-bold text-zinc-800 dark:text-zinc-200 leading-tight">DevNest Pro</h2>
            <p className="text-sm text-zinc-500 mt-0.5">Version 1.2.4 (Windows x64 - Stable Channel)</p>
            <p className="text-xs text-zinc-400 mt-1">Released: May 2026</p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <div className="flex items-center space-x-2 text-sm text-zinc-600 dark:text-zinc-400">
            <span className={`inline-block w-2.5 h-2.5 rounded-full ${isChecking ? "bg-amber-500 animate-ping" : "bg-green-500"}`} />
            <span className="font-semibold">{updateMessage}</span>
          </div>
          <button
            onClick={handleCheckUpdates}
            disabled={isChecking}
            className="px-4 py-2 border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-750 text-zinc-700 dark:text-zinc-200 text-xs font-semibold rounded-md shadow-sm flex items-center space-x-1.5 transition-all disabled:opacity-60"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isChecking ? "animate-spin text-blue-500" : ""}`} />
            <span>Check Updates</span>
          </button>
        </div>
      </div>

      {/* Subscription/License Card */}
      <div className="space-y-4">
        <h3 className="text-base font-bold text-zinc-800 dark:text-zinc-200">Subscription & License</h3>
        <div className="p-6 bg-zinc-50 dark:bg-zinc-900/30 rounded-xl border border-zinc-200 dark:border-zinc-800 grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-start space-x-4">
              <div className="p-3 bg-blue-50 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900 rounded-lg text-blue-600 dark:text-blue-400">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <span className="font-bold text-base text-zinc-800 dark:text-zinc-200">License Activated</span>
                  <span className="bg-blue-100 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider">
                    PRO MEMBER
                  </span>
                </div>
                <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                  Thank you for supporting DevNest! Your license is active and validated on this device.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div className="space-y-1">
                <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Licensed To</span>
                <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">developer@devnest.test</p>
              </div>
              <div className="space-y-1">
                <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">License Key</span>
                <p className="text-sm font-mono text-zinc-650 dark:text-zinc-350">HERD-NEST-PRO-••••-••••-5173</p>
              </div>
            </div>
          </div>

          <div className="flex flex-col justify-center space-y-2.5 lg:border-l border-zinc-200 dark:border-zinc-800 lg:pl-6">
            <button className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-md shadow flex items-center justify-center space-x-2 transition-colors">
              <Key className="w-4 h-4" />
              <span>Manage Subscription</span>
            </button>
            <button className="w-full py-2.5 bg-white dark:bg-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-700 border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-200 text-xs font-semibold rounded-md shadow-sm flex items-center justify-center space-x-2 transition-colors">
              <Shield className="w-4 h-4 text-zinc-400" />
              <span>Deactivate Device</span>
            </button>
          </div>
        </div>
      </div>

      <hr className="border-zinc-200 dark:border-zinc-800" />

      {/* Directory & Paths Config */}
      <div className="space-y-4">
        <h3 className="text-base font-bold text-zinc-800 dark:text-zinc-200">System Directories & Configurations</h3>
        <p className="text-sm text-zinc-500">Quick access to default service folders, active logs, and host configurations.</p>
        
        <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-900/50 overflow-hidden shadow-sm">
          <table className="w-full text-left border-collapse text-sm">
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              <tr className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/10 transition-colors">
                <td className="px-6 py-4 font-semibold text-zinc-800 dark:text-zinc-200 w-1/3">Caddy Configuration</td>
                <td className="px-6 py-4 font-mono text-xs text-zinc-500">C:\Users\VICTUS\.devnest\caddy\Caddyfile</td>
                <td className="px-6 py-4 text-right">
                  <button className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 rounded transition-colors" title="Open Configuration File">
                    <FolderOpen className="w-4 h-4" />
                  </button>
                </td>
              </tr>
              <tr className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/10 transition-colors">
                <td className="px-6 py-4 font-semibold text-zinc-800 dark:text-zinc-200">Hosts Configuration</td>
                <td className="px-6 py-4 font-mono text-xs text-zinc-500">C:\Windows\System32\drivers\etc\hosts</td>
                <td className="px-6 py-4 text-right">
                  <button className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 rounded transition-colors" title="Open Configuration File">
                    <Terminal className="w-4 h-4" />
                  </button>
                </td>
              </tr>
              <tr className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/10 transition-colors">
                <td className="px-6 py-4 font-semibold text-zinc-800 dark:text-zinc-200">Services Log Directory</td>
                <td className="px-6 py-4 font-mono text-xs text-zinc-500">C:\Users\VICTUS\.devnest\logs</td>
                <td className="px-6 py-4 text-right">
                  <button className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 rounded transition-colors" title="Open Directory Folder">
                    <FolderOpen className="w-4 h-4" />
                  </button>
                </td>
              </tr>
              <tr className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/10 transition-colors">
                <td className="px-6 py-4 font-semibold text-zinc-800 dark:text-zinc-200">Root SSL Certificate</td>
                <td className="px-6 py-4 font-mono text-xs text-zinc-500">DevNest Authority CA (Trusted)</td>
                <td className="px-6 py-4 text-right">
                  <span className="bg-green-50 dark:bg-green-950/20 text-green-600 dark:text-green-400 border border-green-200 dark:border-green-800 px-2 py-0.5 rounded text-[10px] font-bold tracking-wider">
                    TRUSTED
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <hr className="border-zinc-200 dark:border-zinc-800" />

      {/* Ecosystem and Credits */}
      <div className="space-y-4">
        <h3 className="text-base font-bold text-zinc-800 dark:text-zinc-200">DevNest Environment Components</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 bg-zinc-50 dark:bg-zinc-900/30 border border-zinc-200 dark:border-zinc-800 rounded-lg text-center space-y-1">
            <span className="text-xs text-zinc-400 uppercase tracking-wider font-semibold">Tauri Runtime</span>
            <p className="text-base font-bold text-zinc-800 dark:text-zinc-200">v2.0.0</p>
          </div>
          <div className="p-4 bg-zinc-50 dark:bg-zinc-900/30 border border-zinc-200 dark:border-zinc-800 rounded-lg text-center space-y-1">
            <span className="text-xs text-zinc-400 uppercase tracking-wider font-semibold">Go Backend</span>
            <p className="text-base font-bold text-zinc-800 dark:text-zinc-200">go1.21.3</p>
          </div>
          <div className="p-4 bg-zinc-50 dark:bg-zinc-900/30 border border-zinc-200 dark:border-zinc-800 rounded-lg text-center space-y-1">
            <span className="text-xs text-zinc-400 uppercase tracking-wider font-semibold">React Core</span>
            <p className="text-base font-bold text-zinc-800 dark:text-zinc-200">v18.3.1</p>
          </div>
          <div className="p-4 bg-zinc-50 dark:bg-zinc-900/30 border border-zinc-200 dark:border-zinc-800 rounded-lg text-center space-y-1">
            <span className="text-xs text-zinc-400 uppercase tracking-wider font-semibold">Caddy Server</span>
            <p className="text-base font-bold text-zinc-800 dark:text-zinc-200">v2.7.5</p>
          </div>
        </div>
      </div>

      <hr className="border-zinc-200 dark:border-zinc-800" />

      {/* Footer Details */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-zinc-400 pb-4">
        <div className="flex items-center space-x-1.5 font-medium">
          <span>Made with</span>
          <Heart className="w-3.5 h-3.5 text-red-500 fill-red-500" />
          <span>for the Laravel and PHP communities.</span>
        </div>
        <div className="flex items-center space-x-3">
          <a href="https://herd.laravel.com" target="_blank" rel="noreferrer" className="hover:text-zinc-650 dark:hover:text-zinc-300 transition-colors inline-flex items-center space-x-1 font-medium">
            <span>Herd Home</span>
            <ArrowUpRight className="w-3 h-3" />
          </a>
          <span>•</span>
          <span>© 2026 DevNest. All rights reserved.</span>
        </div>
      </div>
      </div>
    </motion.div>
  )
}
