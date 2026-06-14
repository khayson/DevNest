import { useEffect, useState, type ReactNode } from "react"
import { useConfigStore } from "@/shared/store/config"
import { Loader2 } from "lucide-react"
import { OnboardingWizard } from "./onboarding-wizard"

function SetupLoadingOverlay() {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-zinc-950/80 backdrop-blur-md">
      <div className="flex flex-col items-center gap-3 text-zinc-200">
        <Loader2 className="h-8 w-8 animate-spin text-violet-400" />
        <p className="text-sm">Loading DevNest…</p>
      </div>
    </div>
  )
}

/**
 * Full-screen onboarding until first_run_completed is set.
 * Config arrives via get_config on WebSocket connect.
 */
export function OnboardingGate({ children }: { children: ReactNode }) {
  const config = useConfigStore((s) => s.config)
  const [allowWizard, setAllowWizard] = useState(false)

  useEffect(() => {
    const t = window.setTimeout(() => setAllowWizard(true), 8000)
    return () => window.clearTimeout(t)
  }, [])

  if (config?.first_run_completed) {
    return <>{children}</>
  }

  const showWizard = config !== null || allowWizard

  return (
    <>
      <div className="pointer-events-none select-none opacity-30 blur-[1px]">{children}</div>
      {showWizard ? <OnboardingWizard /> : <SetupLoadingOverlay />}
    </>
  )
}
