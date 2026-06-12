import { useTelemetryStore } from "../store/telemetry";
import { useCapturedStore } from "../store/captured";
import { useConfigStore } from "../store/config";
import { useSitesStore, type SiteEntry } from "../store/sites";
import { useLogsStore } from "../store/logs";
import { usePHPStore, type PHPSyncPayload } from "../store/php";
import { useDatabasesStore, type DatabaseSyncPayload } from "../store/databases";
import { useAboutStore, type AboutSyncPayload } from "../store/about";
import { notify } from "../store/notifications";
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
    ws?.send(JSON.stringify({ type: "command", command: "get_about", payload: {} }));

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
            Boolean(payload.caddy_available)
          );
        }
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
      } else if (payload.event === "config_update") {
        if (payload.config) {
          useConfigStore.getState().setConfig(payload.config);
          applyTheme(payload.config.theme);
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

export function sendCommand(command: string, payload: Record<string, unknown> = {}): boolean {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: "command", command, payload }));
    return true;
  }
  notify.error("Command failed", "Daemon is offline — start it with go run . daemon", "system");
  console.warn("[Daemon] Cannot send command, WebSocket not connected.");
  return false;
}

export function syncMailInbox(): boolean {
  return sendCommand("get_mail_inbox");
}

export function syncDumpInbox(): boolean {
  return sendCommand("get_dump_inbox");
}

export function syncSites(): boolean {
  return sendCommand("get_sites");
}

export function syncLogInbox(): boolean {
  return sendCommand("get_log_inbox");
}

export function syncPHP(): boolean {
  return sendCommand("get_php");
}

export function syncDatabases(): boolean {
  return sendCommand("scan_databases");
}

export function syncAbout(): boolean {
  return sendCommand("get_about");
}

export function setActivePHP(path: string): boolean {
  return sendCommand("set_active_php", { path });
}

export function updatePHPIni(directives: Record<string, string>): boolean {
  return sendCommand("update_php_ini", directives);
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
}): boolean {
  return sendCommand("add_site", site);
}

export function updateSite(site: {
  name: string
  domain: string
  path: string
  port: number
  tls: boolean
  php_version?: string
}): boolean {
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
