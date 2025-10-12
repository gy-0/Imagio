// Environment detection utilities
export const isTauri = (): boolean => {
  return typeof window !== 'undefined' && !!(window as any).__TAURI__;
};

export const isBrowser = (): boolean => {
  return typeof window !== 'undefined' && !isTauri();
};
