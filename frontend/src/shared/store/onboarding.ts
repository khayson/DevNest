import { create } from "zustand"

export interface InstallResult {
  success: boolean
  message?: string
  runtime?: string
}

interface OnboardingState {
  runtimeInstall: InstallResult | null
  phpInstall: InstallResult | null
  caTrust: InstallResult | null
  hostsFallback: InstallResult | null
  setRuntimeInstall: (result: InstallResult) => void
  setPHPInstall: (result: InstallResult) => void
  setCATrust: (result: InstallResult) => void
  setHostsFallback: (result: InstallResult) => void
  clearRuntimeInstall: () => void
  clearPHPInstall: () => void
}

export const useOnboardingStore = create<OnboardingState>((set) => ({
  runtimeInstall: null,
  phpInstall: null,
  caTrust: null,
  hostsFallback: null,
  setRuntimeInstall: (runtimeInstall) => set({ runtimeInstall }),
  setPHPInstall: (phpInstall) => set({ phpInstall }),
  setCATrust: (caTrust) => set({ caTrust }),
  setHostsFallback: (hostsFallback) => set({ hostsFallback }),
  clearRuntimeInstall: () => set({ runtimeInstall: null }),
  clearPHPInstall: () => set({ phpInstall: null }),
}))
