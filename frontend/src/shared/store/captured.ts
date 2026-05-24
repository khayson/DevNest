import { create } from 'zustand';

export interface CapturedEmail {
  id: string;
  sender: string;
  recipient: string;
  subject: string;
  body: string;
  html: string;
  timestamp: string;
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
  addEmail: (email: CapturedEmail) => void;
  addDump: (dump: CapturedDump) => void;
  clearEmails: () => void;
  clearDumps: () => void;
}

export const useCapturedStore = create<CapturedState>((set) => ({
  emails: [],
  dumps: [],
  addEmail: (email) => set((state) => ({ emails: [email, ...state.emails] })),
  addDump: (dump) => set((state) => ({ dumps: [dump, ...state.dumps] })),
  clearEmails: () => set({ emails: [] }),
  clearDumps: () => set({ dumps: [] }),
}));
