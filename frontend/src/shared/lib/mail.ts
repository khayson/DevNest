/** Parse a raw SMTP message body into display-friendly parts. */
export function parseRawEmail(raw: string) {
  const splitIndex = raw.search(/\r?\n\r?\n/)
  const headerBlock = splitIndex >= 0 ? raw.slice(0, splitIndex) : ""
  let content = splitIndex >= 0 ? raw.slice(splitIndex).replace(/^\r?\n\r?\n/, "") : raw

  const headers = parseHeaderMap(headerBlock)
  const mime = parseMimeContent(content, headers["content-type"])

  return {
    headers,
    headerBlock,
    plainText: mime.plainText,
    html: mime.html,
  }
}

function parseHeaderMap(headerBlock: string): Record<string, string> {
  const headers: Record<string, string> = {}
  for (const line of headerBlock.split(/\r?\n/)) {
    const match = line.match(/^([\w-]+):\s*(.*)/i)
    if (match) headers[match[1].toLowerCase()] = match[2].trim()
  }
  return headers
}

function parseMimeContent(
  content: string,
  outerContentType?: string
): { html: string; plainText: string } {
  const trimmed = content.trim()
  if (!trimmed) return { html: "", plainText: "" }

  if (outerContentType?.toLowerCase().includes("multipart/")) {
    const boundary = extractBoundary(outerContentType)
    if (boundary) return parseMultipart(trimmed, boundary)
  }

  return parseMimePart(trimmed)
}

function parseMimePart(part: string): { html: string; plainText: string } {
  const trimmed = part.trim()
  if (!trimmed) return { html: "", plainText: "" }

  if (/^<!DOCTYPE html/i.test(trimmed) || /^<html[\s>]/i.test(trimmed)) {
    return { html: trimmed, plainText: htmlToPlainText(trimmed) }
  }

  const partSplit = trimmed.search(/\r?\n\r?\n/)
  if (partSplit < 0) {
    if (/<html[\s>]/i.test(trimmed)) {
      const html = extractHtmlDocument(trimmed) ?? trimmed
      return { html, plainText: htmlToPlainText(html) }
    }
    return { html: wrapPlainTextAsHtml(trimmed), plainText: trimmed }
  }

  const partHeaders = trimmed.slice(0, partSplit)
  const partBody = trimmed.slice(partSplit).replace(/^\r?\n\r?\n/, "").trim()
  const contentType = partHeaders.match(/content-type:\s*([^;\r\n]+)/i)?.[1]?.toLowerCase() ?? ""

  if (contentType.includes("multipart/")) {
    const boundary = extractBoundary(partHeaders) ?? extractBoundary(contentType)
    if (boundary) return parseMultipart(partBody, boundary)
  }

  if (contentType.includes("text/html")) {
    const html = extractHtmlDocument(partBody) ?? partBody
    return { html, plainText: htmlToPlainText(html) }
  }

  if (contentType.includes("text/plain")) {
    return { html: wrapPlainTextAsHtml(partBody), plainText: partBody }
  }

  const htmlDoc = extractHtmlDocument(partBody)
  if (htmlDoc) {
    return { html: htmlDoc, plainText: htmlToPlainText(htmlDoc) }
  }

  if (/^MIME-Version:/im.test(trimmed)) {
    return parseMimePart(partBody || trimmed)
  }

  return { html: wrapPlainTextAsHtml(partBody), plainText: partBody }
}

function parseMultipart(body: string, boundary: string): { html: string; plainText: string } {
  const parts = body
    .split(new RegExp(`--${escapeRegExp(boundary)}(?:--)?`, "g"))
    .map((p) => p.trim())
    .filter(Boolean)

  let html = ""
  let plainText = ""

  for (const part of parts) {
    const parsed = parseMimePart(part)
    if (parsed.html && (parsed.html.includes("<html") || parsed.html.includes("<!DOCTYPE"))) {
      html = parsed.html
    } else if (!html && parsed.html) {
      html = parsed.html
    }
    if (parsed.plainText && !plainText) plainText = parsed.plainText
  }

  if (!html && plainText) html = wrapPlainTextAsHtml(plainText)
  if (!plainText && html) plainText = htmlToPlainText(html)

  return { html, plainText }
}

function extractBoundary(value: string): string | null {
  const match = value.match(/boundary="?([^";\r\n]+)"?/i)
  return match?.[1]?.trim() ?? null
}

function extractHtmlDocument(text: string): string | null {
  const docMatch = text.match(/<!DOCTYPE html[\s\S]*?<\/html>/i)
  if (docMatch) return docMatch[0]
  const htmlMatch = text.match(/<html[\s\S]*?<\/html>/i)
  if (htmlMatch) return htmlMatch[0]
  return null
}

function htmlToPlainText(html: string) {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\s+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]+/g, " ")
    .trim()
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

/** HTML suitable for iframe srcDoc preview. */
export function resolveEmailPreviewHtml(email: {
  html?: string
  rawBody?: string
  body?: string
}): string {
  if (email.html?.trim() && looksLikeHtmlDocument(email.html)) {
    return ensureFullHtmlDocument(email.html)
  }

  const raw = email.rawBody ?? email.body ?? ""
  if (raw.trim()) {
    const parsed = parseRawEmail(raw)
    if (parsed.html?.trim()) return ensureFullHtmlDocument(parsed.html)
    if (parsed.plainText?.trim()) return wrapPlainTextAsHtml(parsed.plainText)
  }

  if (email.body?.trim()) {
    if (looksLikeHtmlDocument(email.body)) return ensureFullHtmlDocument(email.body)
    return wrapPlainTextAsHtml(email.body)
  }

  return wrapPlainTextAsHtml("(Empty body)")
}

function looksLikeHtmlDocument(value: string) {
  const t = value.trim()
  return (
    /^<!DOCTYPE html/i.test(t) ||
    /^<html[\s>]/i.test(t) ||
    /<(table|div|p|h[1-6]|body|center)\b/i.test(t)
  )
}

function ensureFullHtmlDocument(html: string) {
  const trimmed = html.trim()
  if (/^<!DOCTYPE html/i.test(trimmed) || /^<html[\s>]/i.test(trimmed)) {
    return trimmed
  }
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><base target="_blank"></head><body>${trimmed}</body></html>`
}

function escapeHtml(text: string) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function wrapPlainTextAsHtml(text: string) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
    body { font-family: ui-sans-serif, system-ui, sans-serif; padding: 20px; line-height: 1.6; color: #27272a; background: #fff; margin: 0; }
    pre { white-space: pre-wrap; word-break: break-word; font-family: inherit; margin: 0; font-size: 14px; }
  </style></head><body><pre>${escapeHtml(text)}</pre></body></html>`;
}

export function formatRelativeTime(isoString: string) {
  try {
    const date = new Date(isoString);
    const diffMs = Date.now() - date.getTime();
    const diffSec = Math.floor(diffMs / 1000);

    if (diffSec < 60) return "just now";
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
    if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;

    return date.toLocaleDateString([], { month: "short", day: "numeric" });
  } catch {
    return isoString;
  }
}

export function formatFullTimestamp(isoString: string) {
  try {
    return new Date(isoString).toLocaleString([], {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return isoString;
  }
}

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function getEmailInitials(address: string) {
  const local = address.split("@")[0]?.trim() || "?";
  const parts = local.split(/[._-]+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return local.slice(0, 2).toUpperCase();
}

export function getAvatarColor(address: string) {
  let hash = 0;
  for (let i = 0; i < address.length; i++) {
    hash = address.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hues = [210, 250, 280, 160, 30, 340];
  const hue = hues[Math.abs(hash) % hues.length];
  return `hsl(${hue} 65% 45%)`;
}

export async function copyToClipboard(text: string) {
  await navigator.clipboard.writeText(text);
}

export function buildEmlFile(email: {
  sender: string;
  recipient: string;
  subject: string;
  timestamp: string;
  rawBody?: string;
  body?: string;
}) {
  if (email.rawBody) return email.rawBody;
  const date = email.timestamp || new Date().toUTCString();
  return [
    `From: ${email.sender}`,
    `To: ${email.recipient}`,
    `Subject: ${email.subject}`,
    `Date: ${date}`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=utf-8",
    "",
    email.body ?? "",
  ].join("\r\n");
}

export function parseHeaderRows(rawHeaders?: string): { key: string; value: string }[] {
  if (!rawHeaders) return [];
  const rows: { key: string; value: string }[] = [];
  for (const line of rawHeaders.split(/\r?\n/)) {
    const match = line.match(/^([\w-]+):\s*(.*)/i);
    if (match) rows.push({ key: match[1], value: match[2] });
  }
  return rows;
}

export function hasHtmlContent(email: { html?: string; rawBody?: string; body?: string }) {
  if (email.html && email.html.includes("<")) return true;
  const raw = email.rawBody ?? email.body ?? "";
  return /content-type:\s*text\/html/i.test(raw) || /<html[\s>]/i.test(raw);
}

export function extractUniqueAddresses(emails: { sender: string; recipient: string }[], field: "sender" | "recipient") {
  return [...new Set(emails.map((e) => e[field]).filter(Boolean))].sort();
}

export type SmtpConnectionState = "listening" | "daemon_offline" | "service_stopped";

export function getSmtpConnectionState(
  isConnected: boolean,
  mailRunning: boolean
): { state: SmtpConnectionState; label: string; hint: string } {
  if (!isConnected) {
    return {
      state: "daemon_offline",
      label: "Daemon offline",
      hint: "The UI cannot reach the Go daemon on ws://127.0.0.1:9090. Start it with: cd backend && go run . daemon",
    };
  }
  if (!mailRunning) {
    return {
      state: "service_stopped",
      label: "SMTP stopped",
      hint: "Daemon is connected but the mail interceptor is not running. Click Start SMTP or go to Services.",
    };
  }
  return {
    state: "listening",
    label: "SMTP listening",
    hint: "Mail interceptor is active on 127.0.0.1:1025 and ready to capture messages.",
  };
}

export function downloadFile(filename: string, content: string, mime = "message/rfc822") {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Turn URLs in plain text into clickable links (returns HTML string for safe rendering). */
export function linkifyPlainText(text: string) {
  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return escaped.replace(
    /(https?:\/\/[^\s<]+)/g,
    '<a href="$1" target="_blank" rel="noreferrer" class="text-blue-600 underline">$1</a>'
  );
}
