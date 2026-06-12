import { useConfigStore } from "@/shared/store/config"

/** Resolves the active theme for Sonner and other UI that needs light/dark. */
export function useTheme() {
  const theme = useConfigStore((s) => s.config?.theme ?? "system")

  if (theme === "system") {
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches
    return { theme: prefersDark ? "dark" : "light" as const }
  }

  return { theme: theme as "light" | "dark" }
}
