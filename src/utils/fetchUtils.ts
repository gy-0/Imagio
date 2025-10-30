/**
 * Unified fetch utility for Tauri applications
 * Provides a consistent way to use Tauri's HTTP plugin across the codebase
 */

import { fetch as tauriFetch } from '@tauri-apps/plugin-http';

/**
 * Resolve the appropriate fetch function based on the environment
 * In Tauri apps, uses Tauri's HTTP plugin to avoid CORS issues
 * Falls back to native fetch in non-Tauri environments (e.g., during development)
 */
export function resolveFetch(): typeof fetch {
  const isTauri =
    typeof window !== 'undefined' &&
    typeof (window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__ !== 'undefined';
  
  return isTauri ? (tauriFetch as unknown as typeof fetch) : fetch;
}

