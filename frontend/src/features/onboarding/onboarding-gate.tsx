import { type ReactNode } from "react"
import { useConfigStore } from "@/shared/store/config"
import { Toaster } from "@/shared/ui/sonner"
import { OnboardingWizard } from "./onboarding-wizard"

/**
 * Full-screen onboarding until first_run_completed is set.
 * Wizard shows immediately — connection/bootstrap happens inside the flow.
 */
export function OnboardingGate({ children }: { children: ReactNode }) {
  const config = useConfigStore((s) => s.config)

  if (config?.first_run_completed) {
    return <>{children}</>
  }

  return (
    <>
      <div className="pointer-events-none select-none opacity-30 blur-[1px]">{children}</div>
      <OnboardingWizard />
      <Toaster richColors closeButton position="bottom-right" style={{ zIndex: 200 }} />
    </>
  )
}
