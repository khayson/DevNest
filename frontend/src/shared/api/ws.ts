import { useTelemetryStore } from "../store/telemetry";
import { useCapturedStore } from "../store/captured";
import { useConfigStore } from "../store/config";
import { useSitesStore, type SiteEntry, type DiscoveredSite } from "../store/sites";
import { useLogsStore } from "../store/logs";
import { usePHPStore, type PHPSyncPayload } from "../store/php";
import { useDatabasesStore, type DatabaseSyncPayload, type SchemaResult, type TableStructureResult, type TableDataResult, type QueryResult, type RowMutationResult } from "../store/databases";
import { useStacksStore, type StacksSyncPayload } from "../store/stacks";
import { useAboutStore, type AboutSyncPayload } from "../store/about";
import { useQueuesStore, type QueueSyncPayload } from "../store/queues";
import { useSchedulerStore, type SchedulerSyncPayload } from "../store/scheduler";
import { useWorkerOutputStore, type WorkerOutputLine } from "../store/worker-output";
import { useNodeStore, type NodeSyncPayload } from "../store/node";
import { notify } from "../store/notifications";
import { useOnboardingStore } from "../store/onboarding";
import { checkPendingServiceStarts } from "../lib/service-actions";

let ws: WebSocket | null = null;
let hasConnectedBefore = false;

export function applyTheme(newTheme: "system" | "light" | "dark") {
  if (newTheme === "dark") {
    document.documentElement.classList.add("dark")
  } else if (newTheme === "light") {
    document.documentElement.classList.remove("dark")
  } else {
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches
    if (prefersDark) {
      document.documentElement.classList.add("dark")
    } else {
      document.documentElement.classList.remove("dark")
    }
  }
}

export function connectToDaemon() {
  if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
    return;
  }

  ws = new WebSocket("ws://127.0.0.1:9090/ws");

  ws.onopen = () => {
    console.log("[Daemon] WebSocket Connected");
    useTelemetryStore.getState().setConnectionStatus(true);
    ws?.send(JSON.stringify({ type: "command", command: "get_mail_inbox", payload: {} }));
    ws?.send(JSON.stringify({ type: "command", command: "get_dump_inbox", payload: {} }));
    ws?.send(JSON.stringify({ type: "command", command: "get_sites", payload: {} }));
    ws?.send(JSON.stringify({ type: "command", command: "get_log_inbox", payload: {} }));
    ws?.send(JSON.stringify({ type: "command", command: "get_php", payload: {} }));
    ws?.send(JSON.stringify({ type: "command", command: "get_databases", payload: {} }));
    ws?.send(JSON.stringify({ type: "command", command: "get_stacks", payload: {} }));
    ws?.send(JSON.stringify({ type: "command", command: "get_about", payload: {} }));
    ws?.send(JSON.stringify({ type: "command", command: "get_queues", payload: {} }));
    ws?.send(JSON.stringify({ type: "command", command: "get_scheduler", payload: {} }));
    ws?.send(JSON.stringify({ type: "command", command: "get_node", payload: {} }));
    ws?.send(JSON.stringify({ type: "command", command: "get_config", payload: {} }));

    if (hasConnectedBefore) {
      notify.info("Daemon reconnected", "Connection to DevNest orchestrator restored.", "system");
    } else {
      notify.success("Daemon connected", "DevNest orchestrator is online.", "system");
      hasConnectedBefore = true;
    }
  };

  ws.onmessage = (event) => {
    try {
      const payload = JSON.parse(event.data);
      if (payload.event === "telemetry_update") {
        let totalCpu = 0;
        let totalMem = 0;
        let active = 0;

        if (payload.metrics) {
          Object.values(payload.metrics).forEach((m: any) => {
            if (m && m.state === "running") {
              totalCpu += m.cpu_percent ?? m.CpuPercent ?? 0;
              totalMem += (m.memory_bytes ?? m.MemoryBytes ?? 0) / (1024 * 1024);
              active += 1;
            }
          });
          checkPendingServiceStarts(payload.metrics);
        }

        useTelemetryStore.getState().updateTelemetry({
          cpuUsage: totalCpu,
          memoryRss: Math.round(totalMem),
          activeServices: active,
        }, payload.metrics || {});
      } else if (payload.event === "mail_captured") {
        if (payload.email) {
          useCapturedStore.getState().addEmail(payload.email);
          const subject = payload.email.subject || "(No subject)";
          const from = payload.email.from ?? payload.email.sender ?? "unknown";
          notify.info("Mail captured", `${from} — ${subject}`, "mail");
        }
      } else if (payload.event === "mail_inbox_sync") {
        if (Array.isArray(payload.emails)) {
          useCapturedStore.getState().setInbox(payload.emails);
        }
      } else if (payload.event === "dump_captured") {
        if (payload.dump) {
          useCapturedStore.getState().addDump(payload.dump);
          notify.info("Dump captured", `New dump from ${payload.dump.source ?? "app"}`, "dump");
        }
      } else if (payload.event === "dump_inbox_sync") {
        if (Array.isArray(payload.dumps)) {
          useCapturedStore.getState().setDumps(payload.dumps);
        }
      } else if (payload.event === "sites_sync") {
        if (Array.isArray(payload.sites)) {
          useSitesStore.getState().setSites(
            payload.sites as SiteEntry[],
            Boolean(payload.caddy_available),
            Array.isArray(payload.parked_paths) ? payload.parked_paths : [],
            Array.isArray(payload.suggested_parked_paths) ? payload.suggested_parked_paths : []
          );
        }
      } else if (payload.event === "parked_scan_result") {
        const path = (payload.path as string) ?? "";
        const sites = Array.isArray(payload.sites) ? (payload.sites as DiscoveredSite[]) : [];
        useSitesStore.getState().setParkedScan(path, sites);
      } else if (payload.event === "log_entry") {
        if (payload.entry) {
          useLogsStore.getState().addEntry(payload.entry);
        }
      } else if (payload.event === "log_inbox_sync") {
        if (Array.isArray(payload.entries)) {
          useLogsStore.getState().setEntries(payload.entries);
        }
      } else if (payload.event === "php_sync") {
        const phpData = (payload.php ?? payload) as PHPSyncPayload;
        if (phpData && Array.isArray(phpData.installations)) {
          usePHPStore.getState().setSync(phpData);
        }
      } else if (payload.event === "database_sync") {
        const dbData = (payload.databases ?? payload) as DatabaseSyncPayload;
        if (dbData && Array.isArray(dbData.services)) {
          useDatabasesStore.getState().setSync(dbData);
        }
      } else if (payload.event === "db_schema_sync") {
        const schema = payload.schema as SchemaResult | undefined;
        if (schema) {
          useDatabasesStore.getState().setSchema(schema);
          if (schema.error) {
            notify.error("Schema browse failed", schema.error, "system");
          }
        }
      } else if (payload.event === "db_table_structure_sync") {
        const structure = payload.structure as TableStructureResult | undefined;
        if (structure) {
          useDatabasesStore.getState().setTableStructure(structure);
          if (structure.error) {
            notify.error("Table structure failed", structure.error, "system");
          }
        }
      } else if (payload.event === "db_table_data_sync") {
        const data = payload.data as TableDataResult | undefined;
        if (data) {
          useDatabasesStore.getState().setTableData(data);
          if (data.error) {
            notify.error("Table data failed", data.error, "system");
          }
        }
      } else if (payload.event === "db_query_sync") {
        const query = payload.query as QueryResult | undefined;
        if (query) {
          useDatabasesStore.getState().setQueryResult(query);
          if (query.error) {
            notify.error("Query failed", query.error, "system");
          }
        }
      } else if (payload.event === "db_row_mutation_sync") {
        const mutation = payload.mutation as RowMutationResult | undefined;
        useDatabasesStore.getState().setMutationLoading(false);
        if (mutation?.error) {
          notify.error("Row save failed", mutation.error, "system");
        } else if (mutation?.message) {
          notify.success("Saved", mutation.message, "system");
        }
      } else if (payload.event === "stacks_sync") {
        const stacksData = (payload.stacks ?? payload) as StacksSyncPayload;
        if (stacksData) {
          useStacksStore.getState().setSync(stacksData);
        }
      } else if (payload.event === "stack_scan_result") {
        const scan = payload.scan as StacksSyncPayload["saved"][number] | undefined;
        if (scan) {
          useStacksStore.getState().setLastScan(scan);
        }
      } else if (payload.event === "migration_result") {
        const domain = payload.domain as string | undefined;
        const success = Boolean(payload.success);
        const message = (payload.message as string) ?? (success ? "Migration completed" : "Migration failed");
        useDatabasesStore.getState().setMigrationStatus(
          domain ? { domain, success, message } : null
        );
        if (success) {
          notify.success("Migration complete", message, "system");
        } else {
          notify.error("Migration failed", message, "system");
        }
      } else if (payload.event === "about_sync") {
        const aboutData = (payload.about ?? payload) as AboutSyncPayload;
        if (aboutData && aboutData.daemon_version) {
          useAboutStore.getState().setSync(aboutData);
        }
      } else if (payload.event === "queue_sync") {
        const queueData = (payload.queues ?? payload) as QueueSyncPayload;
        if (queueData && Array.isArray(queueData.workers)) {
          useQueuesStore.getState().setSync(queueData);
        }
      } else if (payload.event === "scheduler_sync") {
        const schedData = (payload.scheduler ?? payload) as SchedulerSyncPayload;
        if (schedData && Array.isArray(schedData.schedulers)) {
          useSchedulerStore.getState().setSync(schedData);
        }
      } else if (payload.event === "worker_output") {
        const line = payload.line as WorkerOutputLine | undefined;
        if (line?.text) {
          useWorkerOutputStore.getState().addLine(line);
        }
      } else if (payload.event === "worker_output_sync") {
        if (Array.isArray(payload.lines)) {
          useWorkerOutputStore.getState().setLines(payload.lines as WorkerOutputLine[]);
        }
      } else if (payload.event === "node_sync") {
        const nodeData = (payload.node ?? payload) as NodeSyncPayload;
        if (nodeData && Array.isArray(nodeData.installations)) {
          useNodeStore.getState().setSync(nodeData);
        }
      } else if (payload.event === "scheduler_action_result") {
        const domain = payload.domain as string | undefined;
        const success = Boolean(payload.success);
        const message = (payload.message as string) ?? "";
        if (domain) {
          useSchedulerStore.getState().setLastAction({ domain, success, message });
        }
        if (success) {
          notify.success("Scheduler", message, "system");
        } else if (message) {
          notify.error("Scheduler failed", message, "system");
        }
      } else if (payload.event === "config_update") {
        if (payload.config) {
          useConfigStore.getState().setConfig(payload.config);
          applyTheme(payload.config.theme);
        }
      } else if (payload.event === "tunnel_result") {
        const domain = payload.domain as string | undefined;
        const success = Boolean(payload.success);
        const message = (payload.message as string) ?? "";
        if (success && message && message.startsWith("http")) {
          notify.success("Tunnel ready", `${domain} → ${message}`, "system");
        } else if (success && !message) {
          notify.info("Tunnel stopped", domain ?? "Site", "system");
        } else if (!success && message) {
          notify.error("Tunnel failed", message, "system");
        }
      } else if (payload.event === "trust_ca_result") {
        const success = Boolean(payload.success);
        const message = (payload.message as string) ?? "";
        useOnboardingStore.getState().setCATrust({ success, message });
        if (success) {
          notify.success("Certificate trusted", message, "system");
        } else if (message) {
          notify.error("Trust CA failed", message, "system");
        }
      } else if (payload.event === "php_extension_result") {
        const name = payload.name as string | undefined;
        const success = Boolean(payload.success);
        const message = (payload.message as string) ?? "";
        if (success) {
          notify.success("Extension updated", `${name} ${payload.enabled ? "enabled" : "disabled"}`, "system");
        } else if (message) {
          notify.error("Extension toggle failed", message, "system");
        }
      } else if (payload.event === "php_install_result") {
        const success = Boolean(payload.success);
        const message = (payload.message as string) ?? "";
        useOnboardingStore.getState().setPHPInstall({ success, message });
        if (success) {
          notify.success("PHP installed", message || "Refresh the PHP tab to use the new version.", "system");
          syncPHP();
        } else if (message) {
          notify.error("PHP install failed", message, "system");
        }
      } else if (payload.event === "wizard_result") {
        const success = Boolean(payload.success);
        const message = (payload.message as string) ?? "";
        if (success) {
          notify.success("Project created", (payload.path as string) || "Site linked automatically.", "system");
          syncSites();
        } else if (message) {
          notify.error("Wizard failed", message, "system");
        }
      } else if (payload.event === "dump_watch_sync") {
        if (Array.isArray(payload.ignored)) {
          useCapturedStore.getState().setDumpWatchIgnored(payload.ignored as string[]);
        }
      } else if (payload.event === "debug_result") {
        const success = Boolean(payload.success);
        const message = (payload.message as string) ?? "";
        if (success) {
          notify.success("Debug session", payload.active ? "Xdebug enabled" : "Xdebug disabled", "system");
          syncPHP();
        } else if (message) {
          notify.error("Debug session failed", message, "system");
        }
      } else if (payload.event === "forge_result") {
        const success = Boolean(payload.success)
        const message = (payload.message as string) ?? ""
        if (success && message) {
          notify.success("Forge", message, "system")
        } else if (!success && message) {
          notify.error("Forge failed", message, "system")
        } else if (success) {
          notify.success("Forge", "Settings saved", "system")
        }
        if (success) syncSites()
      } else if (payload.event === "forge_sites_sync") {
        if (Array.isArray(payload.sites)) {
          useConfigStore.getState().setForgeSites(
            payload.sites as { id: number; name: string; directory: string }[]
          )
        }
      } else if (payload.event === "runtime_install_result") {
        const success = Boolean(payload.success)
        const message = (payload.message as string) ?? ""
        const runtime = (payload.result as { name?: string })?.name ?? ""
        useOnboardingStore.getState().setRuntimeInstall({ success, message, runtime })
        if (success) {
          notify.success("Runtime installed", message || "Restart the daemon if needed.", "system")
        } else if (message) {
          notify.error("Install failed", message, "system")
        }
      } else if (payload.event === "hosts_fallback") {
        if (payload.active) {
          notify.info("DNS fallback", "Using hosts file for *.test domains", "system")
        }
      } else if (payload.event === "hosts_fallback_result") {
        const success = Boolean(payload.success)
        const message = (payload.message as string) ?? ""
        useOnboardingStore.getState().setHostsFallback({ success, message })
        if (success) {
          notify.success("Hosts sync enabled", message, "system")
        } else if (message) {
          notify.error("Hosts sync failed", message, "system")
        }
      } else if (payload.event === "db_open_result") {
        const success = Boolean(payload.success);
        const message = (payload.message as string) ?? "";
        if (success) {
          notify.success("TablePlus", "Opening connection…", "system");
        } else if (message) {
          notify.error("TablePlus", message, "system");
        }
      } else if (payload.event === "ide_open_result") {
        const success = Boolean(payload.success);
        const message = (payload.message as string) ?? "";
        if (!success && message) {
          notify.error("Open in editor failed", message, "system");
        }
      }
    } catch (err) {
      console.error("[Daemon] Failed to parse message:", err);
    }
  };

  ws.onclose = () => {
    console.log("[Daemon] WebSocket Disconnected. Reconnecting in 3s...");
    useTelemetryStore.getState().setConnectionStatus(false);
    if (hasConnectedBefore) {
      notify.warning("Daemon disconnected", "Reconnecting to ws://127.0.0.1:9090…", "system");
    }
    setTimeout(connectToDaemon, 3000);
  };

  ws.onerror = (err) => {
    console.error("[Daemon] WebSocket Error:", err);
    ws?.close();
  };
}

export interface SendCommandOptions {
  /** Skip error toast when daemon is offline (sync/polling commands). */
  silent?: boolean;
}

export function sendCommand(
  command: string,
  payload: Record<string, unknown> = {},
  options?: SendCommandOptions
): boolean {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: "command", command, payload }));
    return true;
  }
  if (!options?.silent) {
    notify.error("Command failed", "Daemon is offline — use Start daemon on the General page", "system");
  }
  console.warn("[Daemon] Cannot send command, WebSocket not connected.");
  return false;
}

function syncSend(command: string, payload: Record<string, unknown> = {}): boolean {
  return sendCommand(command, payload, { silent: true });
}

export function syncMailInbox(): boolean {
  return syncSend("get_mail_inbox");
}

export function syncDumpInbox(): boolean {
  return syncSend("get_dump_inbox");
}

export function syncSites(): boolean {
  useSitesStore.getState().setLoading(true)
  return syncSend("get_sites")
}

export function syncLogInbox(): boolean {
  return syncSend("get_log_inbox");
}

export function syncPHP(): boolean {
  return syncSend("get_php");
}

export function syncDatabases(): boolean {
  return syncSend("scan_databases");
}

export function fetchDBSchema(payload: {
  engine: string;
  database?: string;
  sqlite_path?: string;
}): boolean {
  useDatabasesStore.getState().setSchemaLoading(true);
  return sendCommand("get_db_schema", payload);
}

export function fetchDBTableStructure(payload: {
  engine: string;
  database?: string;
  sqlite_path?: string;
  table: string;
}): boolean {
  useDatabasesStore.getState().setTableStructureLoading(true);
  return sendCommand("get_db_table_structure", payload);
}

export function fetchDBTableData(payload: {
  engine: string;
  database?: string;
  sqlite_path?: string;
  table: string;
  limit?: number;
  offset?: number;
}): boolean {
  useDatabasesStore.getState().setTableDataLoading(true);
  return sendCommand("get_db_table_data", payload);
}

export function runDBQuery(payload: {
  engine: string;
  database?: string;
  sqlite_path?: string;
  sql: string;
}): boolean {
  useDatabasesStore.getState().setQueryLoading(true);
  return sendCommand("run_db_query", payload);
}

export function mutateDBRow(payload: {
  engine: string;
  database?: string;
  sqlite_path?: string;
  table: string;
  operation: "insert" | "update" | "delete";
  values?: Record<string, string>;
  keys?: Record<string, string>;
}): boolean {
  useDatabasesStore.getState().setMutationLoading(true);
  return sendCommand("mutate_db_row", payload);
}

export function syncStacks(): boolean {
  return syncSend("get_stacks");
}

export function scanStack(rootPath: string): boolean {
  return sendCommand("scan_stack", { root_path: rootPath });
}

export function addStack(payload: { root_path: string; name?: string }): boolean {
  return sendCommand("add_stack", payload);
}

export function removeStack(payload: { id?: string; root_path?: string }): boolean {
  return sendCommand("remove_stack", payload);
}

export function syncAbout(): boolean {
  return sendCommand("get_about");
}

export function startQueueWorker(domain: string): boolean {
  return sendCommand("start_queue_worker", { domain });
}

export function stopQueueWorker(domain: string): boolean {
  return sendCommand("stop_queue_worker", { domain });
}

export function restartQueueWorker(domain: string): boolean {
  return sendCommand("restart_queue_worker", { domain });
}

export function updateQueueConfig(config: {
  tries: number;
  timeout: number;
  memory: number;
  queues: string;
}): boolean {
  return sendCommand("update_queue_config", config);
}

export function startScheduler(domain: string): boolean {
  return sendCommand("start_scheduler", { domain });
}

export function stopScheduler(domain: string): boolean {
  return sendCommand("stop_scheduler", { domain });
}

export function restartScheduler(domain: string): boolean {
  return sendCommand("restart_scheduler", { domain });
}

export function runScheduleNow(domain: string): boolean {
  return sendCommand("run_schedule_now", { domain });
}

export function syncNode(): boolean {
  return sendCommand("get_node");
}

export function setActiveNode(path: string): boolean {
  return sendCommand("set_active_node", { path });
}

export function startNodeDev(domain: string): boolean {
  return sendCommand("start_node_dev", { domain });
}

export function stopNodeDev(domain: string): boolean {
  return sendCommand("stop_node_dev", { domain });
}

export function restartNodeDev(domain: string): boolean {
  return sendCommand("restart_node_dev", { domain });
}

export function clearWorkerOutput(kind: string, domain?: string): boolean {
  return sendCommand("clear_worker_output", { kind, domain: domain ?? "" });
}

export function setActivePHP(path: string): boolean {
  return sendCommand("set_active_php", { path });
}

export function updatePHPIni(directives: Record<string, string>, version?: string): boolean {
  return sendCommand("update_php_ini", { ...directives, version: version ?? "" });
}

export function clearLogInbox(): boolean {
  return sendCommand("clear_log_inbox");
}

export function addSite(site: {
  name: string
  domain: string
  path: string
  port: number
  tls: boolean
  php_version?: string
  group?: string
  aliases?: string[]
}): boolean {
  useSitesStore.getState().setBusy("save")
  return sendCommand("add_site", site);
}

export function updateSite(site: {
  name: string
  domain: string
  path: string
  port: number
  tls: boolean
  php_version?: string
  group?: string
  aliases?: string[]
}): boolean {
  useSitesStore.getState().setBusy("save")
  return sendCommand("update_site", site);
}

export function toggleSiteTls(domain: string): boolean {
  return sendCommand("toggle_site_tls", { domain });
}

export function openPath(path: string): boolean {
  return sendCommand("open_path", { path });
}

export function removeSite(domain: string): boolean {
  return sendCommand("remove_site", { domain });
}

export function scanParkedPath(path: string): boolean {
  useSitesStore.getState().setScanning(true)
  return sendCommand("scan_parked_path", { path })
}

export function addParkedPath(payload: {
  path: string;
  name?: string;
  import_sites?: boolean;
}): boolean {
  useSitesStore.getState().setBusy("park")
  return sendCommand("add_parked_path", payload)
}

export function removeParkedPath(id: string): boolean {
  return sendCommand("remove_parked_path", { id })
}

export function rescanParkedPaths(): boolean {
  useSitesStore.getState().setBusy("rescan")
  return sendCommand("rescan_parked_paths")
}

export function importDiscoveredSites(sites: DiscoveredSite[]): boolean {
  useSitesStore.getState().setBusy("import")
  return sendCommand("import_discovered_sites", { sites })
}

export function startSiteTunnel(domain: string): boolean {
  return sendCommand("start_tunnel", { domain })
}

export function stopSiteTunnel(domain: string): boolean {
  return sendCommand("stop_tunnel", { domain })
}

export function trustLocalCA(): boolean {
  return sendCommand("trust_local_ca")
}

export function togglePHPExtension(name: string, enable: boolean): boolean {
  return sendCommand("toggle_php_extension", { name, enable })
}

export function installPHP(version = "8.3.21"): boolean {
  return sendCommand("install_php", { version })
}

export function createLaravelProject(payload: {
  name: string
  parent_dir?: string
  starter_kit?: string
  auto_link?: boolean
  update_env?: boolean
}): boolean {
  return sendCommand("create_laravel_project", payload)
}

export function linkSite(payload: { path?: string; domain?: string; update_env?: boolean }): boolean {
  return sendCommand("link_site", payload)
}

export function exportDevnestYml(domain: string): boolean {
  return sendCommand("export_devnest_yml", { domain })
}

export function importDevnestYml(path: string): boolean {
  return sendCommand("import_devnest_yml", { path })
}

export function debugStart(port = 9003, ideKey = "PHPSTORM"): boolean {
  return sendCommand("debug_start", { port, ide_key: ideKey })
}

export function debugStop(): boolean {
  return sendCommand("debug_stop")
}

export function openInIDE(payload: { file?: string; line?: number; message?: string }): boolean {
  return sendCommand("open_in_ide", payload)
}

export function openDatabase(engine: string, sqlitePath?: string): boolean {
  return sendCommand("open_database", { engine, sqlite_path: sqlitePath ?? "" })
}

export function toggleDumpWatch(id: string, watch: boolean): boolean {
  return sendCommand("toggle_dump_watch", { id, watch })
}

export function updateForge(payload: { api_token?: string; server_id?: number; server_name?: string }): boolean {
  return sendCommand("update_forge", payload)
}

export function forgeDeploy(forgeSiteId: number): boolean {
  return sendCommand("forge_deploy", { forge_site_id: forgeSiteId })
}

export function forgeListSites(): boolean {
  return sendCommand("forge_list_sites", {})
}

export function linkForgeSite(domain: string, forgeSiteId: number): boolean {
  return sendCommand("link_forge_site", { domain, forge_site_id: forgeSiteId })
}

export function installRuntime(runtime: string): boolean {
  return sendCommand("install_runtime", { runtime })
}

export function completeFirstRun(): boolean {
  return sendCommand("complete_first_run", {})
}

export function resetFirstRun(): boolean {
  return sendCommand("reset_first_run", {})
}

export function syncConfig(): boolean {
  return syncSend("get_config", {})
}

export function enableHostsFallback(): boolean {
  return sendCommand("enable_hosts_fallback", {})
}
