export type GeneralCardId = "services" | "integrations" | "startup" | "appearance" | "connection"

export const DEFAULT_GENERAL_CARD_ORDER: GeneralCardId[] = [
  "services",
  "integrations",
  "startup",
  "appearance",
  "connection",
]

const STORAGE_KEY = "devnest-general-card-order"

export function loadGeneralCardOrder(): GeneralCardId[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return [...DEFAULT_GENERAL_CARD_ORDER]
    const parsed = JSON.parse(raw) as GeneralCardId[]
    if (!Array.isArray(parsed)) return [...DEFAULT_GENERAL_CARD_ORDER]
    const merged = [...parsed]
    for (const id of DEFAULT_GENERAL_CARD_ORDER) {
      if (!merged.includes(id)) merged.push(id)
    }
    return merged.filter((id) => DEFAULT_GENERAL_CARD_ORDER.includes(id))
  } catch {
    return [...DEFAULT_GENERAL_CARD_ORDER]
  }
}

export function saveGeneralCardOrder(order: GeneralCardId[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(order))
  } catch {
    /* ignore */
  }
}

export const GENERAL_CARD_LABELS: Record<GeneralCardId, string> = {
  services: "Live services",
  integrations: "AI & Forge",
  startup: "Startup",
  appearance: "Appearance",
  connection: "Connection & storage",
}
