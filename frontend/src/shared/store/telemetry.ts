export interface TelemetryData {
  cpuUsage: number;
  memoryRss: number;
  activeServices: number;
}

interface TelemetryState {
  isConnected: boolean;
  telemetry: {
    cpuUsage: number;
    memoryRss: number;
    activeServices: number;
  };
  services: Record<string, any>;
  setConnectionStatus: (status: boolean) => void;
  updateTelemetry: (data: any, servicesMap?: any) => void;
}

import { create } from 'zustand';

export const useTelemetryStore = create<TelemetryState>((set) => ({
  isConnected: false,
  telemetry: {
    cpuUsage: 0,
    memoryRss: 0,
    activeServices: 0,
  },
  services: {},
  setConnectionStatus: (status) => set({ isConnected: status }),
  updateTelemetry: (data, servicesMap) => set((state) => ({ 
    telemetry: { ...state.telemetry, ...data },
    services: servicesMap || state.services
  })),
}));
