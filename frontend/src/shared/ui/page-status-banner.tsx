import { Info } from "lucide-react";
import { getPageMeta, STATUS_STYLES, type PageStatus } from "../lib/navigation";

interface PageStatusBannerProps {
  pageId: string;
}

export function PageStatusBanner({ pageId }: PageStatusBannerProps) {
  const meta = getPageMeta(pageId);
  if (!meta || meta.status === "live") return null;

  const styles = STATUS_STYLES[meta.status as PageStatus];

  return (
    <div
      className={`mb-6 flex items-start gap-3 rounded-lg border px-4 py-3 text-sm ${
        meta.status === "mock"
          ? "border-zinc-200 bg-zinc-50 text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900/50 dark:text-zinc-400"
          : "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-300"
      }`}
      role="status"
    >
      <Info className="mt-0.5 h-4 w-4 shrink-0 opacity-70" />
      <div className="min-w-0 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold text-zinc-800 dark:text-zinc-200">
            {meta.status === "mock" ? "Preview page" : "Partially connected"}
          </span>
          <span
            className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${styles.badge}`}
          >
            {meta.label}
          </span>
        </div>
        <p className="text-xs leading-relaxed opacity-90">{meta.description}</p>
      </div>
    </div>
  );
}
