import { motion } from "framer-motion"
import { Trash2, Terminal } from "lucide-react"
import { useCapturedStore } from "../shared/store/captured"

export function Dumps() {
  const dumps = useCapturedStore((state) => state.dumps)
  const clearDumps = useCapturedStore((state) => state.clearDumps)

  const formatTimestamp = (isoString: string) => {
    try {
      const d = new Date(isoString)
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    } catch {
      return isoString
    }
  }

  // Detect and format Var-Dumper HTML payloads
  const isHtml = (str: string) => {
    return str.trim().startsWith("<")
  }

  return (
    <motion.div 
      initial={{ opacity: 0, filter: "blur(4px)" }} 
      animate={{ opacity: 1, filter: "blur(0px)" }} 
      className="space-y-6 h-full flex flex-col min-h-0"
    >
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">Dumps</h1>
          <p className="text-base text-zinc-500 dark:text-zinc-400">View real-time dump() and dd() outputs from your applications.</p>
        </div>
        
        {dumps.length > 0 && (
          <button 
            onClick={clearDumps}
            className="px-3 py-1.5 border border-zinc-200 dark:border-zinc-800 bg-white hover:bg-zinc-50 dark:bg-zinc-900 dark:hover:bg-zinc-800 text-red-600 dark:text-red-400 text-xs font-semibold rounded-md shadow-sm flex items-center space-x-1.5 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear Dumps</span>
          </button>
        )}
      </div>

      <hr className="border-zinc-200 dark:border-zinc-800" />

      {dumps.length === 0 ? (
        <div className="flex-1 border border-dashed border-zinc-300 dark:border-zinc-800 rounded-lg flex flex-col items-center justify-center p-8 text-center text-zinc-400 dark:text-zinc-500 space-y-3">
          <div className="p-3 bg-zinc-100 dark:bg-zinc-900 rounded-full">
            <Terminal className="w-6 h-6 text-zinc-400 dark:text-zinc-600" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Waiting for dumps...</p>
            <p className="text-xs">Configure your PHP var-dumper server to send dumps to port <span className="font-mono bg-zinc-100 dark:bg-zinc-800 px-1 py-0.5 rounded">9912</span></p>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto space-y-4 pr-1 custom-scrollbar min-h-0">
          {dumps.map((d) => (
            <div 
              key={d.id} 
              className="border border-zinc-200 dark:border-zinc-800 rounded-lg bg-white dark:bg-zinc-900/50 overflow-hidden shadow-sm"
            >
              {/* Header */}
              <div className="px-4 py-2 bg-zinc-50 dark:bg-zinc-900/80 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between text-xs">
                <div className="flex items-center space-x-2 text-zinc-500">
                  <span className="font-semibold text-zinc-700 dark:text-zinc-300">{d.id}</span>
                  <span>•</span>
                  <span>Source: {d.source.split(":")[0]}</span>
                </div>
                <div className="text-zinc-400 font-mono">
                  {formatTimestamp(d.timestamp)}
                </div>
              </div>

              {/* Payload Content */}
              <div className="p-4 overflow-x-auto bg-zinc-950 font-mono text-xs text-zinc-100 custom-scrollbar max-h-96">
                {isHtml(d.payload) ? (
                  <div 
                    dangerouslySetInnerHTML={{ __html: d.payload }} 
                    className="sf-dump-output"
                  />
                ) : (
                  <pre className="whitespace-pre-wrap">{d.payload}</pre>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  )
}
