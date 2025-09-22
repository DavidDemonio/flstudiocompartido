import { contextBridge, ipcRenderer } from 'electron';
import type { BridgeConfig } from './bridge';

contextBridge.exposeInMainWorld('bridge', {
  start: (config: Partial<BridgeConfig>) => ipcRenderer.invoke('bridge:start', config),
  stop: () => ipcRenderer.invoke('bridge:stop'),
  onStats: (callback: (stats: { roundTripTimeMs: number | null; timestamp: number }) => void) => {
    ipcRenderer.on('bridge-stats', (_event, stats) => callback(stats));
  },
  onError: (callback: (message: string) => void) => {
    ipcRenderer.on('bridge-error', (_event, message) => callback(message));
  },
});

declare global {
  interface Window {
    bridge: {
      start: (config: Partial<BridgeConfig>) => Promise<unknown>;
      stop: () => Promise<unknown>;
      onStats: (callback: (stats: { roundTripTimeMs: number | null; timestamp: number }) => void) => void;
      onError: (callback: (message: string) => void) => void;
    };
  }
}
