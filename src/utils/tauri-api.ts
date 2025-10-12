// Tauri API wrapper for browser compatibility
import { isBrowser } from './environment';

let tauriApis: any = null;

const loadTauriApis = async () => {
  if (tauriApis) return tauriApis;

  if (isBrowser()) {
    // Browser environment - use mocks
    const mocks = await import('../mocks');
    tauriApis = {
      convertFileSrc: mocks.convertFileSrc,
      invoke: mocks.invoke,
      open: mocks.open,
      save: mocks.save
    };
  } else {
    // Tauri environment - use real APIs
    const [tauriCore, tauriDialog] = await Promise.all([
      import('@tauri-apps/api/core'),
      import('@tauri-apps/plugin-dialog')
    ]);
    tauriApis = {
      convertFileSrc: tauriCore.convertFileSrc,
      invoke: tauriCore.invoke,
      open: tauriDialog.open,
      save: tauriDialog.save
    };
  }

  return tauriApis;
};

export const getTauriApis = loadTauriApis;
