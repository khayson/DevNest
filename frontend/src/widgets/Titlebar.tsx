import { Window } from '@tauri-apps/api/window'
import { Minus, Square, X, Play, Square as Stop } from 'lucide-react'
import { sendCommand } from '../shared/api/ws'

// Safely determine if we are running inside the Tauri native app
const isTauri = typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window);

const appWindow = isTauri ? new Window('main') : null as any;

export function Titlebar() {
  return (
    <div
      data-tauri-drag-region
      className="h-10 flex items-center justify-between select-none fixed top-0 left-0 right-0 z-50 bg-black/20 border-b border-white/5 backdrop-blur-md"
    >
      {/* Titlebar Logo / Space */}
      <div className="pl-4 flex items-center gap-4 h-full pointer-events-none">
        <span className="text-xs font-medium text-white/50 tracking-wider">DEVNEST</span>
      </div>

      {/* Global Controls */}
      <div className="flex items-center gap-2 drag-none">
        <button 
          onClick={() => sendCommand("stop_all")}
          className="flex items-center gap-1.5 px-3 py-1 rounded text-xs font-medium text-white/60 hover:text-white hover:bg-white/10 border border-transparent hover:border-white/10 transition-all"
        >
          <Stop className="w-3 h-3 text-red-400" /> Stop
        </button>
        <button 
          onClick={() => sendCommand("start_all")}
          className="flex items-center gap-1.5 px-3 py-1 rounded text-xs font-medium text-white/60 hover:text-white hover:bg-white/10 border border-transparent hover:border-white/10 transition-all mr-4"
        >
          <Play className="w-3 h-3 text-green-400" /> Start All
        </button>
      </div>

      {/* Windows-style Controls (Only visible in native Tauri app) */}
      {isTauri && (
        <div className="flex h-full drag-none">
          <button
            onClick={() => appWindow.minimize()}
            className="inline-flex items-center justify-center w-12 h-full text-white/50 hover:bg-white/10 transition-colors"
          >
            <Minus className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => appWindow.toggleMaximize()}
            className="inline-flex items-center justify-center w-12 h-full text-white/50 hover:bg-white/10 transition-colors"
          >
            <Square className="w-3 h-3" />
          </button>
          <button
            onClick={() => appWindow.close()}
            className="inline-flex items-center justify-center w-12 h-full text-white/50 hover:bg-red-500 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  )
}
