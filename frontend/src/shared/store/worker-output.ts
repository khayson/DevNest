import { create } from "zustand";

export interface WorkerOutputLine {
  key: string;
  domain: string;
  kind: string;
  stream: string;
  text: string;
  time_unix: number;
}

interface WorkerOutputState {
  lines: WorkerOutputLine[];
  addLine: (line: WorkerOutputLine) => void;
  setLines: (lines: WorkerOutputLine[]) => void;
  clear: () => void;
}

export function filterWorkerLines(
  lines: WorkerOutputLine[],
  kind: string,
  domain?: string
): WorkerOutputLine[] {
  return lines.filter((l) => {
    if (l.kind !== kind) return false;
    if (domain && l.domain !== domain) return false;
    return true;
  });
}

export const useWorkerOutputStore = create<WorkerOutputState>((set) => ({
  lines: [],
  addLine: (line) =>
    set((state) => {
      const next = [...state.lines, line];
      if (next.length > 600) {
        return { lines: next.slice(-600) };
      }
      return { lines: next };
    }),
  setLines: (lines) => set({ lines: lines.slice(-600) }),
  clear: () => set({ lines: [] }),
}));
