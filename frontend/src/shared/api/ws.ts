import { useTelemetryStore } from "../store/telemetry";
import { useCapturedStore } from "../store/captured";
import { useConfigStore } from "../store/config";

let ws: WebSocket | null = null;

function applyTheme(newTheme: "system" | "light" | "dark") {
  if (newTheme === "dark") {
    document.documentElement.classList.add("dark")
  } else if (newTheme === "light") {
    document.documentElement.classList.remove("dark")
  } else {
    // System
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

  // Connect to the Go daemon WebSocket
  ws = new WebSocket("ws://127.0.0.1:9090/ws");

  ws.onopen = () => {
    console.log("[Daemon] WebSocket Connected");
    useTelemetryStore.getState().setConnectionStatus(true);
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
            if (m) {
              totalCpu += m.CpuPercent || 0;
              totalMem += (m.MemoryBytes || 0) / (1024 * 1024); // Convert to MB
              active += 1;
            }
          });
        }
        
        useTelemetryStore.getState().updateTelemetry({
          cpuUsage: totalCpu,
          memoryRss: Math.round(totalMem),
          activeServices: active,
        }, payload.metrics || {});
      } else if (payload.event === "mail_captured") {
        if (payload.email) {
          useCapturedStore.getState().addEmail(payload.email);
        }
      } else if (payload.event === "dump_captured") {
        if (payload.dump) {
          useCapturedStore.getState().addDump(payload.dump);
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
    setTimeout(connectToDaemon, 3000);
  };

  ws.onerror = (err) => {
    console.error("[Daemon] WebSocket Error:", err);
    ws?.close();
  };
}

export function sendCommand(command: string, payload: any = {}) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: "command", command, payload }));
  } else {
    console.warn("[Daemon] Cannot send command, WebSocket not connected.");
  }
}
