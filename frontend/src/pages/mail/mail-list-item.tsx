import { formatBytes, formatRelativeTime, getAvatarColor, getEmailInitials, hasHtmlContent } from "@/shared/lib/mail"
import type { CapturedEmail } from "@/shared/store/captured"
import { Badge } from "@/shared/ui/badge"
import { cn } from "@/shared/lib/utils"

interface MailListItemProps {
  email: CapturedEmail
  isSelected: boolean
  isNew: boolean
  onSelect: () => void
}

export function MailListItem({ email, isSelected, isNew, onSelect }: MailListItemProps) {
  const initials = getEmailInitials(email.sender || email.recipient || "?")
  const color = getAvatarColor(email.sender || email.id)
  const isHtml = hasHtmlContent(email)
  const sender = email.sender || "unknown"

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "group relative flex w-full gap-3 px-3 py-3 text-left transition-colors",
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

      <div
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white shadow-sm ring-2 ring-background"
        style={{ backgroundColor: color }}
      >
        {initials}
      </div>

      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex items-start justify-between gap-2">
          <p
            className={cn(
              "truncate text-sm leading-tight",
              isSelected ? "font-semibold text-foreground" : "font-medium text-foreground/90"
            )}
          >
            {email.subject || "(No subject)"}
          </p>
          <span className="shrink-0 pt-0.5 text-[10px] tabular-nums text-muted-foreground">
            {formatRelativeTime(email.timestamp)}
          </span>
        </div>

        <p className="truncate text-xs text-muted-foreground">{sender}</p>

        <div className="flex flex-wrap items-center gap-1.5">
          {email.size != null && email.size > 0 && (
            <span className="text-[10px] text-muted-foreground/80">{formatBytes(email.size)}</span>
          )}
          {isHtml && (
            <Badge variant="secondary" className="h-4 px-1.5 text-[9px] font-semibold uppercase tracking-wide">
              HTML
            </Badge>
          )}
          {isNew && (
            <Badge className="h-4 border-0 bg-emerald-500/15 px-1.5 text-[9px] font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
              New
            </Badge>
          )}
        </div>
      </div>
    </button>
  )
}
