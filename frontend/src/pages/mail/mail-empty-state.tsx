import { useState } from "react"
import { motion } from "framer-motion"
import {
  Braces,
  Check,
  Copy,
  Inbox,
  Mail,
  Play,
  Radio,
  RefreshCw,
  Server,
  Terminal,
  WifiOff,
  PauseCircle,
} from "lucide-react"
import { Button } from "@/shared/ui/button"
import { Badge } from "@/shared/ui/badge"
import { ScrollArea } from "@/shared/ui/scroll-area"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/ui/tabs"
import { copyToClipboard } from "@/shared/lib/mail"
import { cn } from "@/shared/lib/utils"

const ENV_SNIPPET = `MAIL_MAILER=smtp
MAIL_HOST=127.0.0.1
MAIL_PORT=1025
MAIL_ENCRYPTION=null`

const FRAMEWORK_SNIPPETS = {
  laravel: {
    label: "Laravel",
    icon: Braces,
    filename: ".env",
    code: ENV_SNIPPET,
  },
  symfony: {
    label: "Symfony",
    icon: Braces,
    filename: ".env",
    code: `MAILER_DSN=smtp://127.0.0.1:1025?encryption=null`,
  },
  node: {
    label: "Node",
    icon: Terminal,
    filename: "nodemailer",
    code: `const transporter = nodemailer.createTransport({
  host: "127.0.0.1",
  port: 1025,
  secure: false,
});`,
  },
} as const

type FrameworkKey = keyof typeof FRAMEWORK_SNIPPETS

interface MailEmptyStateProps {
  onCopyEnv: () => void
  copiedEnv: boolean
  isConnected: boolean
  mailRunning: boolean
  isStarting?: boolean
  onStartSmtp?: () => void
  onRefresh?: () => void
  refreshing?: boolean
}

const STEPS = [
  {
    icon: Server,
    title: "Configure SMTP",
    body: "Point your app at 127.0.0.1:1025 — drop-in compatible with Mailpit and Mailhog.",
  },
  {
    icon: Mail,
    title: "Send mail",
    body: "Trigger any email from your app, or run the included PowerShell test script.",
  },
  {
    icon: Inbox,
    title: "Catch it here",
    body: "Messages land in this inbox instantly. Preview HTML, inspect headers, export .eml.",
  },
] as const

function CopyChip({
  label,
  value,
  mono = true,
}: {
  label: string
  value: string
  mono?: boolean
}) {
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
      className="group inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-left transition-colors hover:border-primary/40 hover:bg-muted/50"
    >
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
        <p className={cn("text-sm font-medium text-foreground", mono && "font-mono")}>{value}</p>
      </div>
      {copied ? (
        <Check className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
      ) : (
        <Copy className="h-3.5 w-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
      )}
    </button>
  )
}

function InboxIllustration() {
  return (
    <div className="relative mx-auto flex h-36 w-36 items-center justify-center">
      <div className="absolute inset-0 rounded-full bg-primary/[0.06] blur-2xl" />
      <div className="absolute inset-4 rounded-3xl border border-dashed border-primary/20 bg-gradient-to-b from-primary/[0.04] to-transparent" />
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.35 }}
        className="absolute -left-1 top-6 rotate-[-12deg] rounded-xl border border-border bg-card p-2.5 shadow-sm"
      >
        <Mail className="h-5 w-5 text-muted-foreground/50" />
      </motion.div>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.35 }}
        className="absolute -right-2 top-10 rotate-[10deg] rounded-xl border border-border bg-card p-2.5 shadow-sm"
      >
        <Mail className="h-5 w-5 text-muted-foreground/40" />
      </motion.div>
      <motion.div
        initial={{ opacity: 0, scale: 0.92 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.05, duration: 0.4 }}
        className="relative z-10 flex flex-col items-center gap-2 rounded-2xl border border-border bg-card px-6 py-5 shadow-md"
      >
        <div className="rounded-xl bg-primary/10 p-3">
          <Inbox className="h-8 w-8 text-primary" />
        </div>
        <div className="flex gap-1">
          <span className="h-1 w-1 rounded-full bg-muted-foreground/30" />
          <span className="h-1 w-1 rounded-full bg-muted-foreground/30" />
          <span className="h-1 w-1 rounded-full bg-muted-foreground/30" />
        </div>
      </motion.div>
    </div>
  )
}

function StatusBanner({
  isConnected,
  mailRunning,
  isStarting,
  onStartSmtp,
}: Pick<MailEmptyStateProps, "isConnected" | "mailRunning" | "isStarting" | "onStartSmtp">) {
  if (!isConnected) {
    return (
      <div className="flex flex-col gap-3 rounded-xl border border-destructive/25 bg-destructive/[0.06] p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-destructive/10">
            <WifiOff className="h-4 w-4 text-destructive" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">Daemon not connected</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Start the Go backend before mail can be captured.
            </p>
          </div>
        </div>
        <code className="shrink-0 rounded-lg border border-border bg-background px-3 py-2 font-mono text-xs text-foreground">
          go run . daemon
        </code>
      </div>
    )
  }

  if (!mailRunning) {
    return (
      <div className="flex flex-col gap-3 rounded-xl border border-amber-500/25 bg-amber-500/[0.06] p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-500/10">
            <PauseCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">SMTP service is stopped</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Start the mail trap to begin capturing outgoing messages.
            </p>
          </div>
        </div>
        {onStartSmtp && (
          <Button
            type="button"
            size="sm"
            className="shrink-0 gap-1.5 bg-amber-600 hover:bg-amber-700"
            onClick={onStartSmtp}
            disabled={isStarting}
          >
            <Play className="h-3.5 w-3.5" />
            {isStarting ? "Starting…" : "Start SMTP"}
          </Button>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-emerald-500/25 bg-emerald-500/[0.06] p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10">
          <Radio className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground">Ready to capture mail</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            SMTP is listening — send a message from your app and it will appear here.
          </p>
        </div>
      </div>
      <Badge className="shrink-0 border-0 bg-emerald-500/15 text-emerald-700 dark:text-emerald-400">
        <span className="mr-1.5 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
        Listening on :1025
      </Badge>
    </div>
  )
}

function FrameworkSnippetPanel({
  onCopyEnv,
  copiedEnv,
}: {
  onCopyEnv: () => void
  copiedEnv: boolean
}) {
  const [framework, setFramework] = useState<FrameworkKey>("laravel")
  const [copiedTab, setCopiedTab] = useState(false)
  const active = FRAMEWORK_SNIPPETS[framework]

  const handleCopyActive = async () => {
    await copyToClipboard(active.code)
    setCopiedTab(true)
    setTimeout(() => setCopiedTab(false), 1500)
    if (framework === "laravel") onCopyEnv()
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      <Tabs value={framework} onValueChange={(v) => setFramework(v as FrameworkKey)}>
        <div className="flex flex-col gap-3 border-b border-border bg-muted/30 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <TabsList className="h-8 bg-background/80">
            {(Object.keys(FRAMEWORK_SNIPPETS) as FrameworkKey[]).map((key) => (
              <TabsTrigger key={key} value={key} className="px-3 text-xs">
                {FRAMEWORK_SNIPPETS[key].label}
              </TabsTrigger>
            ))}
          </TabsList>
          <Button type="button" variant="outline" size="sm" className="h-8 shrink-0 text-xs" onClick={handleCopyActive}>
            {(framework === "laravel" && copiedEnv) || copiedTab ? (
              <Check className="h-3.5 w-3.5 text-emerald-500" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
            {(framework === "laravel" && copiedEnv) || copiedTab ? "Copied" : "Copy snippet"}
          </Button>
        </div>

        {(Object.keys(FRAMEWORK_SNIPPETS) as FrameworkKey[]).map((key) => {
          const SnippetIcon = FRAMEWORK_SNIPPETS[key].icon
          return (
          <TabsContent key={key} value={key} className="mt-0">
            <div className="flex items-center gap-2 border-b border-border/60 bg-muted/20 px-4 py-2">
              <SnippetIcon className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="font-mono text-[11px] text-muted-foreground">{FRAMEWORK_SNIPPETS[key].filename}</span>
            </div>
            <pre className="overflow-x-auto p-4 font-mono text-xs leading-relaxed text-foreground/85">
              {FRAMEWORK_SNIPPETS[key].code}
            </pre>
          </TabsContent>
        )})}
      </Tabs>
    </div>
  )
}

export function MailEmptyState({
  onCopyEnv,
  copiedEnv,
  isConnected,
  mailRunning,
  isStarting,
  onStartSmtp,
  onRefresh,
  refreshing,
}: MailEmptyStateProps) {
  const ready = isConnected && mailRunning

  return (
    <ScrollArea className="h-full min-h-0 flex-1">
      <div className="relative min-h-full">
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-48 bg-gradient-to-b from-primary/[0.04] to-transparent"
          aria-hidden
        />

        <div className="relative mx-auto max-w-3xl space-y-8 px-5 py-8 sm:px-8 sm:py-10">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
            className="flex flex-col items-center text-center"
          >
            <InboxIllustration />
            <h2 className="mt-6 text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
              Nothing in the inbox yet
            </h2>
            <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
              DevNest intercepts outgoing mail locally so you can debug templates, headers, and
              attachments without sending real email.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08, duration: 0.35 }}
          >
            <StatusBanner
              isConnected={isConnected}
              mailRunning={mailRunning}
              isStarting={isStarting}
              onStartSmtp={onStartSmtp}
            />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.12, duration: 0.35 }}
            className="flex flex-wrap justify-center gap-2 sm:justify-start"
          >
            <CopyChip label="Host" value="127.0.0.1" />
            <CopyChip label="Port" value="1025" />
            <CopyChip label="Endpoint" value="127.0.0.1:1025" />
          </motion.div>

          <motion.ol
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.16, duration: 0.35 }}
            className="grid gap-3 sm:grid-cols-3"
          >
            {STEPS.map(({ icon: Icon, title, body }, i) => (
              <li
                key={title}
                className="relative rounded-xl border border-border bg-card p-4 shadow-sm"
              >
                {i < STEPS.length - 1 && (
                  <span
                    className="absolute -right-2 top-1/2 hidden h-px w-4 bg-border sm:block"
                    aria-hidden
                  />
                )}
                <div className="mb-3 flex items-center gap-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-xs font-bold text-primary">
                    {i + 1}
                  </span>
                  <Icon className="h-4 w-4 text-muted-foreground" />
                </div>
                <p className="text-sm font-medium text-foreground">{title}</p>
                <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{body}</p>
              </li>
            ))}
          </motion.ol>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.35 }}
            className="space-y-3"
          >
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Configuration
            </p>
            <FrameworkSnippetPanel onCopyEnv={onCopyEnv} copiedEnv={copiedEnv} />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.24, duration: 0.35 }}
            className="flex flex-col gap-3 rounded-xl border border-border bg-muted/20 p-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <div>
              <p className="text-sm font-medium text-foreground">Quick test without an app</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Run from the project root to send a sample message into this inbox.
              </p>
              <code className="mt-2 inline-block rounded-md bg-background px-2 py-1 font-mono text-xs text-foreground/80">
                .\scripts\send-test-mail.ps1
              </code>
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              {onRefresh && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={onRefresh}
                  disabled={!isConnected || refreshing}
                >
                  <RefreshCw className={cn("h-3.5 w-3.5", refreshing && "animate-spin")} />
                  Sync inbox
                </Button>
              )}
              {ready && (
                <span className="inline-flex items-center gap-1.5 rounded-md bg-emerald-500/10 px-2.5 py-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-400">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
                  Waiting for your first message
                </span>
              )}
            </div>
          </motion.div>
        </div>
      </div>
    </ScrollArea>
  )
}

export { ENV_SNIPPET }
