import { useState, type MouseEvent } from "react"
import { Check, Copy } from "lucide-react"
import { Button } from "@/shared/ui/button"
import { copyToClipboard } from "@/shared/lib/mail"
import { cn } from "@/shared/lib/utils"

interface CopyButtonProps {
  value: string
  label?: string
  variant?: "button" | "chip" | "icon"
  className?: string
  title?: string
}

export function CopyButton({
  value,
  label = "Copy",
  variant = "button",
  className,
  title,
}: CopyButtonProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async (e: MouseEvent) => {
    e.stopPropagation()
    await copyToClipboard(value)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  if (variant === "icon") {
    return (
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className={cn("h-7 w-7 shrink-0", className)}
        onClick={handleCopy}
        title={title ?? `Copy ${label}`}
      >
        {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
      </Button>
    )
  }

  if (variant === "chip") {
    return (
      <button
        type="button"
        onClick={handleCopy}
        title={title ?? `Copy ${label}`}
        className={cn(
          "group inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-left transition-colors hover:border-primary/40 hover:bg-muted/50",
          className
        )}
      >
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
          <p className="truncate font-mono text-sm font-medium text-foreground">{value}</p>
        </div>
        {copied ? (
          <Check className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
        ) : (
          <Copy className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        )}
      </button>
    )
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className={cn("h-8 gap-1.5 text-xs", className)}
      onClick={handleCopy}
      title={title}
    >
      {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
      {copied ? "Copied" : label}
    </Button>
  )
}

interface CopyCodeBlockProps {
  title: string
  code: string
  className?: string
}

export function CopyCodeBlock({ title, code, className }: CopyCodeBlockProps) {
  return (
    <div className={cn("overflow-hidden rounded-lg border border-border bg-card", className)}>
      <div className="flex items-center justify-between border-b border-border bg-muted/40 px-3 py-2">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{title}</span>
        <CopyButton value={code} label="Copy" variant="button" className="h-7" />
      </div>
      <pre className="overflow-x-auto p-3 font-mono text-xs leading-relaxed text-foreground/85">{code}</pre>
    </div>
  )
}
