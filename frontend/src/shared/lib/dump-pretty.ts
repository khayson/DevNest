/** Whether the dump payload is Symfony VarDumper HTML output. */
export function isVarDumperHtml(payload: string): boolean {
  const t = payload.trim()
  return t.startsWith("<") && (t.includes("sf-dump") || t.includes("Sfdump("))
}

/** Strip tags for a plain-text fallback preview. */
export function dumpPlainText(payload: string): string {
  return payload
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}
