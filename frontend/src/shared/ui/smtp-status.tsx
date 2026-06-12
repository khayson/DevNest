import { Radio, WifiOff, PauseCircle, Info, Loader2 } from "lucide-react"
import { getSmtpConnectionState, type SmtpConnectionState } from "../lib/mail"

const STATUS_UI: Record<
  SmtpConnectionState,
  { className: string; icon: typeof Radio; dot: string }
> = {
  listening: {
    className:
      "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-400",
    icon: Radio,
    dot: "bg-emerald-500 animate-pulse",
  },
  daemon_offline: {
    className:
      "border-red-200 bg-red-50 text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-400",
    icon: WifiOff,
    dot: "bg-red-500",
  },
  service_stopped: {
    className:
      "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-400",
    icon: PauseCircle,
    dot: "bg-amber-500",
  },
}

interface SmtpStatusProps {
  isConnected: boolean;
  mailRunning: boolean;
  isStarting?: boolean;
  onStartSmtp?: () => void;
}

export function SmtpStatus({ isConnected, mailRunning, isStarting, onStartSmtp }: SmtpStatusProps) {
  const { state, label, hint } = getSmtpConnectionState(isConnected, mailRunning)
  const ui = STATUS_UI[state]
  const Icon = ui.icon

  return (
    <div className="flex items-center gap-2">
      <div
        className={`group relative inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold cursor-help ${ui.className}`}
        title={hint}
      >
        <span className={`h-2 w-2 rounded-full shrink-0 ${isStarting ? "bg-amber-500 animate-pulse" : ui.dot}`} />
        {isStarting ? (
          <Loader2 className="h-3 w-3 shrink-0 animate-spin" />
        ) : (
          <Icon className="h-3 w-3 shrink-0" />
        )}
        {isStarting ? "Starting SMTP…" : label}
        {!isStarting && <Info className="h-3 w-3 opacity-50 hidden sm:inline" />}
        <div className="pointer-events-none absolute right-0 top-full z-50 mt-2 w-64 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-3 text-xs font-normal text-zinc-600 dark:text-zinc-400 opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
          {hint}
        </div>
      </div>
      {state === "service_stopped" && onStartSmtp && !isStarting && (
        <button
          onClick={onStartSmtp}
          className="px-2.5 py-1 rounded-md bg-amber-600 hover:bg-amber-700 active:scale-95 text-white text-[11px] font-semibold transition-all"
        >
          Start SMTP
        </button>
      )}
      {isStarting && (
        <button
          disabled
          className="px-2.5 py-1 rounded-md bg-amber-600/70 text-white text-[11px] font-semibold flex items-center gap-1.5 cursor-wait"
        >
          <Loader2 className="h-3 w-3 animate-spin" />
          Starting…
        </button>
      )}
    </div>
  )
}
