export interface LaravelLogParts {
  timestamp: string
  env: string
  level: string
  body: string
}

/** Laravel single-line format: [2024-01-01 12:00:00] local.ERROR: message */
export function parseLaravelLogLine(message: string): LaravelLogParts | null {
  const m = message.match(/^\[([^\]]+)\]\s+(\w+)\.(\w+):\s([\s\S]*)$/)
  if (!m) return null
  return { timestamp: m[1], env: m[2], level: m[3], body: m[4] }
}

export function isJsonLogMessage(message: string): boolean {
  const t = message.trim()
  return (t.startsWith("{") && t.endsWith("}")) || (t.startsWith("[") && t.endsWith("]"))
}

export function tryPrettyJson(message: string): string | null {
  const t = message.trim()
  if (!t.startsWith("{") && !t.startsWith("[")) return null
  try {
    return JSON.stringify(JSON.parse(t), null, 2)
  } catch {
    return null
  }
}

/** One-line preview for the log list. */
export function logPreviewText(message: string, max = 100): string {
  const laravel = parseLaravelLogLine(message)
  const text = laravel?.body ?? message
  const plain = text.replace(/\s+/g, " ").trim()
  if (plain.length <= max) return plain || "(empty)"
  return `${plain.slice(0, max)}…`
}

export function logMessageIsPrettyable(message: string): boolean {
  return isJsonLogMessage(message) || parseLaravelLogLine(message) !== null
}

/** Escape HTML entities before injecting highlighted JSON. */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
}

/** Lightweight JSON syntax highlight for log viewer (no extra deps). */
export function highlightJson(json: string): string {
  const escaped = escapeHtml(json)
  return escaped.replace(
    /("(?:\\.|[^"\\])*")(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/g,
    (match, str, colon) => {
      if (str !== undefined) {
        if (colon) {
          return `<span class="log-json-key">${str}</span>${colon}`
        }
        return `<span class="log-json-str">${str}</span>`
      }
      if (match === "true" || match === "false" || match === "null") {
        return `<span class="log-json-const">${match}</span>`
      }
      return `<span class="log-json-num">${match}</span>`
    }
  )
}
