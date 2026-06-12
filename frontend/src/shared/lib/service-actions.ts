import { sendCommand } from "../api/ws";
import { notify } from "../store/notifications";
import { useTelemetryStore } from "../store/telemetry";

const pendingStarts = new Map<string, ReturnType<typeof setTimeout>>();

const SERVICE_LABELS: Record<string, string> = {
  "embedded-mail-server": "Mail interceptor",
  dns: "DNS resolver",
  "embedded-dump-server": "Dump server",
  caddy: "Caddy reverse proxy",
  php: "PHP CGI",
};

/** Start a service with toast feedback and success/error detection via telemetry. */
export function startServiceWithFeedback(serviceId: string): boolean {
  const label = SERVICE_LABELS[serviceId] ?? serviceId;

  if (!sendCommand("start_service", { serviceId })) {
    notify.error("Daemon offline", `Cannot start ${label} — connect to the daemon first.`, "service");
    return false;
  }

  notify.info(`Starting ${label}…`, "Waiting for service to come online.", "service");

  const existing = pendingStarts.get(serviceId);
  if (existing) clearTimeout(existing);

  const timeout = setTimeout(() => {
    pendingStarts.delete(serviceId);
    const running =
      useTelemetryStore.getState().services[serviceId]?.state === "running";
    if (!running) {
      notify.warning(
        `${label} slow to start`,
        "No confirmation yet — check the Services page or daemon logs.",
        "service"
      );
    }
  }, 6000);

  pendingStarts.set(serviceId, timeout);
  return true;
}

/** Call when telemetry updates — resolves pending start toasts. */
export function checkPendingServiceStarts(services: Record<string, { state?: string }>) {
  for (const [serviceId, timeout] of pendingStarts.entries()) {
    if (services[serviceId]?.state === "running") {
      clearTimeout(timeout);
      pendingStarts.delete(serviceId);
      const label = SERVICE_LABELS[serviceId] ?? serviceId;
      notify.success(`${label} is running`, "Service started successfully.", "service");
    }
  }
}
