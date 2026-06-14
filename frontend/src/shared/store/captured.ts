import { create } from 'zustand';
import { parseRawEmail } from '../lib/mail';

export interface CapturedEmail {
  id: string;
  sender: string;
  recipient: string;
  subject: string;
  body: string;
  html: string;
  timestamp: string;
  size?: number;
  rawHeaders?: string;
  rawBody?: string;
}

export interface CapturedDump {
  id: string;
  payload: string;
  size: number;
  source: string;
  timestamp: string;
}

interface CapturedState {
  emails: CapturedEmail[];
  dumps: CapturedDump[];
  dumpWatchIgnored: string[];
  addEmail: (email: Partial<CapturedEmail> & { from?: string; to?: string; size?: number }) => void;
  setInbox: (emails: Array<Partial<CapturedEmail> & { from?: string; to?: string; size?: number }>) => void;
  addDump: (dump: Partial<CapturedDump> & { Payload?: string }) => void;
  setDumps: (dumps: CapturedDump[]) => void;
  setDumpWatchIgnored: (ids: string[]) => void;
  isDumpWatched: (id: string) => boolean;
  removeDump: (id: string) => void;
  removeEmail: (id: string) => void;
  clearEmails: () => void;
  clearDumps: () => void;
}

function normalizeEmail(raw: Partial<CapturedEmail> & { from?: string; to?: string; size?: number }): CapturedEmail {
  const rawBody = raw.rawBody ?? raw.body ?? "";
  const parsed = rawBody ? parseRawEmail(rawBody) : null;

  return {
    id: raw.id ?? crypto.randomUUID(),
    sender: raw.sender ?? raw.from ?? "",
    recipient: raw.recipient ?? raw.to ?? "",
    subject: raw.subject ?? "",
    body: parsed?.plainText ?? rawBody,
    html: raw.html ?? parsed?.html ?? "",
    timestamp: raw.timestamp ?? new Date().toISOString(),
    size: raw.size,
    rawHeaders: parsed?.headerBlock,
    rawBody,
  };
}

function normalizeDump(raw: Partial<CapturedDump> & { Payload?: string }): CapturedDump {
  const payload = raw.payload ?? raw.Payload ?? "";
  return {
    id: raw.id ?? crypto.randomUUID(),
    payload,
    size: raw.size ?? payload.length,
    source: raw.source ?? "unknown",
    timestamp: raw.timestamp ?? new Date().toISOString(),
  };
}

export const useCapturedStore = create<CapturedState>((set, get) => ({
  emails: [],
  dumps: [],
  dumpWatchIgnored: [],
  addEmail: (email) =>
    set((state) => {
      const normalized = normalizeEmail(email);
      if (state.emails.some((e) => e.id === normalized.id)) return state;
      return { emails: [normalized, ...state.emails] };
    }),
  setInbox: (emails) =>
    set({
      emails: emails.map((e) => normalizeEmail(e)),
    }),
  addDump: (dump) => set((state) => {
    const normalized = normalizeDump(dump);
    if (state.dumps.some((d) => d.id === normalized.id)) return state;
    return { dumps: [normalized, ...state.dumps] };
  }),
  setDumps: (dumps) => set({ dumps: dumps.map((d) => normalizeDump(d)) }),
  setDumpWatchIgnored: (dumpWatchIgnored) => set({ dumpWatchIgnored }),
  isDumpWatched: (id) => !get().dumpWatchIgnored.includes(id),
  removeDump: (id) => set((state) => ({ dumps: state.dumps.filter((d) => d.id !== id) })),
  removeEmail: (id) => set((state) => ({ emails: state.emails.filter((e) => e.id !== id) })),
  clearEmails: () => set({ emails: [] }),
  clearDumps: () => set({ dumps: [] }),
}));
