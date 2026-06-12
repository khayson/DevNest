export type GeneralCardId = "services" | "startup" | "appearance" | "connection"

export const DEFAULT_GENERAL_CARD_ORDER: GeneralCardId[] = [
  "services",
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
    const valid =
      Array.isArray(parsed) &&
      parsed.length === DEFAULT_GENERAL_CARD_ORDER.length &&
      DEFAULT_GENERAL_CARD_ORDER.every((id) => parsed.includes(id))
    return valid ? parsed : [...DEFAULT_GENERAL_CARD_ORDER]
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
  startup: "Startup",
  appearance: "Appearance",
  connection: "Connection & storage",
}
