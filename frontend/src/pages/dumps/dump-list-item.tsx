import { Eye, EyeOff } from "lucide-react"
import { formatBytes, formatRelativeTime } from "@/shared/lib/mail"
import type { CapturedDump } from "@/shared/store/captured"
import { Badge } from "@/shared/ui/badge"
import { Button } from "@/shared/ui/button"
import { CopyButton } from "@/shared/ui/copy-button"
import { cn } from "@/shared/lib/utils"

function isHtmlPayload(payload: string) {
  return payload.trim().startsWith("<")
}

function previewText(payload: string, max = 80) {
  const plain = isHtmlPayload(payload)
    ? payload.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()
    : payload.replace(/\s+/g, " ").trim()
  if (plain.length <= max) return plain || "(empty payload)"
  return `${plain.slice(0, max)}…`
}

interface DumpListItemProps {
  dump: CapturedDump
  isSelected: boolean
  isNew: boolean
  watched?: boolean
  onToggleWatch?: () => void
  onSelect: () => void
}

export function DumpListItem({ dump, isSelected, isNew, watched = true, onToggleWatch, onSelect }: DumpListItemProps) {
  const html = isHtmlPayload(dump.payload)
  const sourceHost = dump.source.split(":")[0] || dump.source

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          onSelect()
        }
      }}
      className={cn(
        "relative flex w-full cursor-pointer flex-col gap-1.5 px-3 py-3 text-left transition-colors outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
        isSelected
          ? "bg-primary/[0.07] ring-1 ring-inset ring-primary/25"
          : "hover:bg-muted/70"
      )}
    >
      {(isNew || isSelected) && (
        <span
          className={cn(
            "absolute left-0 top-3 bottom-3 w-0.5 rounded-full",
            isNew ? "bg-emerald-500" : "bg-primary"
          )}
        />
      )}

      <div className="flex items-start justify-between gap-2">
        <span className="font-mono text-xs font-semibold text-foreground">{dump.id}</span>
        <div className="flex shrink-0 items-center gap-1">
          {onToggleWatch && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-6 w-6 opacity-60 hover:opacity-100"
              title={watched ? "Pause watching this dump" : "Resume watching"}
              onClick={(e) => {
                e.stopPropagation()
                onToggleWatch()
              }}
            >
              {watched ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
            </Button>
          )}
          <CopyButton
            value={dump.payload}
            label="payload"
            variant="icon"
            className="h-6 w-6 opacity-60 hover:opacity-100"
          />
          <span className="text-[10px] tabular-nums text-muted-foreground">
            {formatRelativeTime(dump.timestamp)}
          </span>
        </div>
      </div>

      <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">
        {previewText(dump.payload)}
      </p>

      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-[10px] text-muted-foreground">{sourceHost}</span>
        {dump.size > 0 && (
          <span className="text-[10px] text-muted-foreground/80">{formatBytes(dump.size)}</span>
        )}
        {html && (
          <Badge variant="secondary" className="h-4 px-1.5 text-[9px] font-semibold uppercase">
            HTML
          </Badge>
        )}
        {isNew && (
          <Badge className="h-4 border-0 bg-emerald-500/15 px-1.5 text-[9px] font-semibold uppercase text-emerald-700 dark:text-emerald-400">
            New
          </Badge>
        )}
      </div>
    </div>
  )
}

export { isHtmlPayload, previewText }
