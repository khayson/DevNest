import {
  ChevronLeft,
  ChevronDown,
  ChevronUp,
  Copy,
  Check,
  Download,
  Trash2,
  FileText,
  ScrollText,
  ListTree,
  Code2,
  MailOpen,
} from "lucide-react"
import { useState } from "react"
import type { CapturedEmail } from "@/shared/store/captured"
import {
  copyToClipboard,
  formatBytes,
  formatFullTimestamp,
  getAvatarColor,
  getEmailInitials,
  hasHtmlContent,
  parseHeaderRows,
  parseRawEmail,
  resolveEmailPreviewHtml,
} from "@/shared/lib/mail"
import { Button } from "@/shared/ui/button"
import { Badge } from "@/shared/ui/badge"
import { ScrollArea } from "@/shared/ui/scroll-area"
import { Tabs, TabsList, TabsTrigger } from "@/shared/ui/tabs"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu"

type ContentTab = "preview" | "text" | "headers" | "source"

interface MailReaderProps {
  email: CapturedEmail | null
  activeTab: ContentTab
  onTabChange: (tab: ContentTab) => void
  onBack?: () => void
  onDelete: () => void
  onExport: (email: CapturedEmail) => void
  onPrev: () => void
  onNext: () => void
  hasPrev: boolean
  hasNext: boolean
}

function CopyChip({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false)
  const handleCopy = async () => {
    await copyToClipboard(value)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }
  return (
    <button
      type="button"
      onClick={handleCopy}
      className="inline-flex items-center gap-1 rounded-md border border-border bg-muted/40 px-2 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
    >
      {copied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
      {copied ? "Copied" : label}
    </button>
  )
}

function buildSourceView(email: CapturedEmail) {
  if (email.rawBody) return email.rawBody
  if (email.rawHeaders) return `${email.rawHeaders}\n\n${email.body}`
  return `From: ${email.sender}\nTo: ${email.recipient}\nSubject: ${email.subject}\nDate: ${email.timestamp}\n\n${email.body}`
}

function useHeaders(email: CapturedEmail | null) {
  if (!email) return []
  if (email.rawHeaders) return parseHeaderRows(email.rawHeaders)
  if (email.rawBody) return parseHeaderRows(parseRawEmail(email.rawBody).headerBlock)
  return [
    { key: "From", value: email.sender },
    { key: "To", value: email.recipient },
    { key: "Subject", value: email.subject },
    { key: "Date", value: email.timestamp },
  ].filter((h) => h.value)
}

export function MailReader({
  email,
  activeTab,
  onTabChange,
  onBack,
  onDelete,
  onExport,
  onPrev,
  onNext,
  hasPrev,
  hasNext,
}: MailReaderProps) {
  const headers = useHeaders(email)

  if (!email) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 bg-muted/20 p-8 text-center">
        <div className="rounded-2xl bg-muted/60 p-4">
          <MailOpen className="h-8 w-8 text-muted-foreground/60" />
        </div>
        <div>
          <p className="text-sm font-medium text-foreground">Select a message</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Choose an email from the list, or use ↑↓ / j k to navigate
          </p>
        </div>
      </div>
    )
  }

  const initials = getEmailInitials(email.sender || email.recipient || "?")
  const avatarColor = getAvatarColor(email.sender || email.id)
  const source = buildSourceView(email)

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="shrink-0 border-b border-border bg-card px-4 py-4 sm:px-5">
        {onBack && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="-ml-2 mb-2 h-8 md:hidden"
            onClick={onBack}
          >
            <ChevronLeft className="h-4 w-4" />
            Inbox
          </Button>
        )}

        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex min-w-0 gap-3">
            <div
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white shadow-sm"
              style={{ backgroundColor: avatarColor }}
            >
              {initials}
            </div>
            <div className="min-w-0 space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base font-semibold leading-snug text-foreground sm:text-lg">
                  {email.subject || "(No subject)"}
                </h2>
                {hasHtmlContent(email) && (
                  <Badge variant="secondary" className="text-[10px] uppercase">
                    HTML
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                <span className="font-medium text-foreground/80">{email.sender || "—"}</span>
                {" → "}
                <span className="font-mono">{email.recipient || "—"}</span>
              </p>
              <p className="text-[11px] text-muted-foreground">
                {formatFullTimestamp(email.timestamp)}
                {email.size != null && email.size > 0 && (
                  <>
                    <span className="mx-1.5 text-border">·</span>
                    {formatBytes(email.size)}
                  </>
                )}
                <span className="mx-1.5 text-border">·</span>
                <span className="font-mono text-[10px]">{email.id.slice(0, 8)}</span>
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 shrink-0">
            <CopyChip value={email.sender} label="From" />
            <CopyChip value={email.recipient} label="To" />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button type="button" variant="outline" size="sm" className="h-8 text-xs">
                  <Copy className="h-3.5 w-3.5" />
                  More
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuItem onClick={() => copyToClipboard(source)}>Copy raw source</DropdownMenuItem>
                <DropdownMenuItem onClick={() => copyToClipboard(email.body)}>Copy body</DropdownMenuItem>
                {email.html && (
                  <DropdownMenuItem onClick={() => copyToClipboard(email.html!)}>Copy HTML</DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
            <Button type="button" variant="outline" size="sm" className="h-8" onClick={() => onExport(email)}>
              <Download className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Export</span>
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={onDelete}
              title="Delete message"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
            <div className="ml-1 hidden items-center gap-0.5 sm:flex">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={onPrev}
                disabled={!hasPrev}
                title="Previous (↑)"
              >
                <ChevronUp className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={onNext}
                disabled={!hasNext}
                title="Next (↓)"
              >
                <ChevronDown className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={(v) => onTabChange(v as ContentTab)}
        className="flex min-h-0 flex-1 flex-col"
      >
        <div className="shrink-0 border-b border-border bg-muted/30 px-4 py-2 sm:px-5">
          <TabsList className="h-8 bg-muted/80">
            <TabsTrigger value="preview" className="gap-1.5 px-2.5 text-xs">
              <FileText className="h-3.5 w-3.5" />
              Preview
            </TabsTrigger>
            <TabsTrigger value="text" className="gap-1.5 px-2.5 text-xs">
              <ScrollText className="h-3.5 w-3.5" />
              Plain text
            </TabsTrigger>
            <TabsTrigger value="headers" className="gap-1.5 px-2.5 text-xs">
              <ListTree className="h-3.5 w-3.5" />
              Headers
            </TabsTrigger>
            <TabsTrigger value="source" className="gap-1.5 px-2.5 text-xs">
              <Code2 className="h-3.5 w-3.5" />
              Source
            </TabsTrigger>
          </TabsList>
        </div>

        <div className="min-h-0 flex-1 bg-background">
          {activeTab === "preview" && (
            <iframe
              title="Email preview"
              srcDoc={resolveEmailPreviewHtml(email)}
              className="h-full min-h-[280px] w-full border-0 bg-white"
              sandbox="allow-same-origin"
            />
          )}

          {activeTab === "text" && (
            <ScrollArea className="h-full">
              <pre className="whitespace-pre-wrap p-5 text-sm leading-relaxed text-foreground/90 font-sans">
                {email.body || "(Empty body)"}
              </pre>
            </ScrollArea>
          )}

          {activeTab === "headers" && (
            <ScrollArea className="h-full">
              <div className="p-4 sm:p-5">
                <table className="w-full border-collapse text-xs">
                  <tbody>
                    {headers.map((h) => (
                      <tr key={h.key} className="border-b border-border/60">
                        <td className="w-28 shrink-0 py-2.5 pr-4 align-top font-semibold text-muted-foreground">
                          {h.key}
                        </td>
                        <td className="break-all py-2.5 font-mono text-foreground/90 select-all">{h.value}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </ScrollArea>
          )}

          {activeTab === "source" && (
            <ScrollArea className="h-full">
              <div className="p-4 sm:p-5">
                <pre className="whitespace-pre-wrap rounded-lg border border-border bg-muted/30 p-4 font-mono text-[11px] leading-relaxed text-foreground/80">
                  {source}
                </pre>
              </div>
            </ScrollArea>
          )}
        </div>
      </Tabs>
    </div>
  )
}

export type { ContentTab }
