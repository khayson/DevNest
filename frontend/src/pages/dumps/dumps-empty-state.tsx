import { motion } from "framer-motion"
import {
  Braces,
  Play,
  Radio,
  RefreshCw,
  Terminal,
  WifiOff,
  PauseCircle,
  Code2,
} from "lucide-react"
import { Button } from "@/shared/ui/button"
import { Badge } from "@/shared/ui/badge"
import { ScrollArea } from "@/shared/ui/scroll-area"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/ui/tabs"
import { CopyButton, CopyCodeBlock } from "@/shared/ui/copy-button"
import { cn } from "@/shared/lib/utils"

const TEST_SCRIPT = ".\\scripts\\send-test-dump.ps1"

const LARAVEL_SNIPPET = `# .env — point var-dumper at DevNest
VAR_DUMPER_FORMAT=html
# Laravel dump-server listens locally; configure your app to send to:
# tcp://127.0.0.1:9912`

const PHP_SNIPPET = `// Symfony Var-Dumper — server mode
// composer require symfony/var-dumper
dump($variable); // when server is configured to 127.0.0.1:9912`

// Or raw TCP from PowerShell:
// .\\scripts\\send-test-dump.ps1`

interface DumpsEmptyStateProps {
  isConnected: boolean
  dumpRunning: boolean
  isStarting?: boolean
  onStartDumpServer?: () => void
  onRefresh?: () => void
  refreshing?: boolean
}

function StatusBanner({
  isConnected,
  dumpRunning,
  isStarting,
  onStartDumpServer,
}: Pick<DumpsEmptyStateProps, "isConnected" | "dumpRunning" | "isStarting" | "onStartDumpServer">) {
  if (!isConnected) {
    return (
      <div className="flex flex-col gap-3 rounded-xl border border-destructive/25 bg-destructive/[0.06] p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-destructive/10">
            <WifiOff className="h-4 w-4 text-destructive" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">Daemon not connected</p>
            <p className="mt-0.5 text-xs text-muted-foreground">Start the Go backend before dumps can be captured.</p>
          </div>
        </div>
        <CopyCodeBlock title="Start daemon" code="go run . daemon" className="w-full sm:max-w-xs" />
      </div>
    )
  }

  if (!dumpRunning) {
    return (
      <div className="flex flex-col gap-3 rounded-xl border border-amber-500/25 bg-amber-500/[0.06] p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-500/10">
            <PauseCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">Dump server is stopped</p>
            <p className="mt-0.5 text-xs text-muted-foreground">Start the dump service to receive var-dumper output.</p>
          </div>
        </div>
        {onStartDumpServer && (
          <Button type="button" size="sm" className="gap-1.5 bg-amber-600 hover:bg-amber-700" onClick={onStartDumpServer} disabled={isStarting}>
            <Play className="h-3.5 w-3.5" />
            {isStarting ? "Starting…" : "Start dump server"}
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
          <p className="text-sm font-semibold text-foreground">Ready to capture dumps</p>
          <p className="mt-0.5 text-xs text-muted-foreground">Send output to 127.0.0.1:9912, then click Sync dumps below.</p>
        </div>
      </div>
      <Badge className="shrink-0 border-0 bg-emerald-500/15 text-emerald-700 dark:text-emerald-400">
        <span className="mr-1.5 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
        Listening on :9912
      </Badge>
    </div>
  )
}

export function DumpsEmptyState({
  isConnected,
  dumpRunning,
  isStarting,
  onStartDumpServer,
  onRefresh,
  refreshing,
}: DumpsEmptyStateProps) {
  const ready = isConnected && dumpRunning

  return (
    <ScrollArea className="h-full min-h-0 flex-1">
      <div className="relative min-h-full">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-48 bg-gradient-to-b from-primary/[0.04] to-transparent" aria-hidden />

        <div className="relative mx-auto max-w-3xl space-y-8 px-5 py-8 sm:px-8 sm:py-10">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="text-center sm:text-left">
            <div className="mx-auto mb-4 inline-flex rounded-2xl bg-primary/10 p-4 sm:mx-0">
              <Terminal className="h-9 w-9 text-primary" />
            </div>
            <h2 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">No dumps captured yet</h2>
            <p className="mt-2 max-w-lg text-sm text-muted-foreground">
              DevNest listens on TCP port 9912 for Symfony Var-Dumper payloads. Run the test script, then hit Sync dumps.
            </p>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}>
            <StatusBanner
              isConnected={isConnected}
              dumpRunning={dumpRunning}
              isStarting={isStarting}
              onStartDumpServer={onStartDumpServer}
            />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.12 }}
            className="flex flex-wrap justify-center gap-2 sm:justify-start"
          >
            <CopyButton label="Host" value="127.0.0.1" variant="chip" />
            <CopyButton label="Port" value="9912" variant="chip" />
            <CopyButton label="Endpoint" value="127.0.0.1:9912" variant="chip" />
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.16 }}>
            <CopyCodeBlock title="Quick test (PowerShell)" code={TEST_SCRIPT} />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.18 }}
            className="overflow-hidden rounded-xl border border-border bg-card shadow-sm"
          >
            <Tabs defaultValue="laravel">
              <div className="border-b border-border bg-muted/30 px-4 py-2">
                <TabsList className="h-8 bg-background/80">
                  <TabsTrigger value="laravel" className="text-xs">Laravel</TabsTrigger>
                  <TabsTrigger value="php" className="text-xs">PHP</TabsTrigger>
                </TabsList>
              </div>
              <TabsContent value="laravel" className="mt-0 p-0">
                <CopyCodeBlock title="Laravel .env" code={LARAVEL_SNIPPET} className="rounded-none border-0" />
              </TabsContent>
              <TabsContent value="php" className="mt-0 p-0">
                <CopyCodeBlock title="PHP" code={PHP_SNIPPET} className="rounded-none border-0" />
              </TabsContent>
            </Tabs>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="grid gap-3 sm:grid-cols-2"
          >
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-foreground">
                <Braces className="h-3.5 w-3.5 text-primary" />
                Symfony Var-Dumper
              </p>
              <CopyButton value="dump($var);" label="Copy" variant="button" className="w-full justify-center" />
            </div>
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-foreground">
                <Code2 className="h-3.5 w-3.5 text-primary" />
                Raw TCP
              </p>
              <CopyButton value="127.0.0.1:9912" label="Copy endpoint" variant="button" className="w-full justify-center" />
            </div>
          </motion.div>

          {onRefresh && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.24 }}
              className="flex flex-wrap items-center justify-center gap-3 sm:justify-start"
            >
              <Button type="button" variant="default" size="sm" onClick={onRefresh} disabled={!isConnected || refreshing}>
                <RefreshCw className={cn("h-3.5 w-3.5", refreshing && "animate-spin")} />
                Sync dumps
              </Button>
              {ready && (
                <span className="inline-flex items-center gap-1.5 text-xs text-emerald-700 dark:text-emerald-400">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
                  Waiting for your first dump
                </span>
              )}
            </motion.div>
          )}
        </div>
      </div>
    </ScrollArea>
  )
}
