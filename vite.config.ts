import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const isBrowserMode = mode === 'browser' || process.env.VITE_BROWSER_MODE === 'true';

  return {
    plugins: [react()],

    // Prevent vite from obscuring rust errors
    clearScreen: false,

    // Conditional server config
    server: {
      port: 1420,
      strictPort: true,
      watch: {
        // In browser mode, don't ignore src-tauri (though it won't exist)
        ignored: isBrowserMode ? [] : ['**/src-tauri/**'],
      },
    },

    // Browser mode specific config
    ...(isBrowserMode && {
      define: {
        // Mock Tauri environment for browser
        'window.__TAURI__': false,
      },
      // Handle Tauri imports in browser mode
      optimizeDeps: {
        exclude: ['@tauri-apps/api', '@tauri-apps/plugin-dialog', '@tauri-apps/plugin-fs'],
      },
    }),

    // Build config
    build: {
      rollupOptions: {
        external: isBrowserMode ? [
          '@tauri-apps/api',
          '@tauri-apps/plugin-dialog',
          '@tauri-apps/plugin-fs',
          '@tauri-apps/plugin-clipboard-manager',
          '@tauri-apps/plugin-http'
        ] : [],
      },
    },
  };
});
