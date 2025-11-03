/**
 * Application-wide constants
 * Centralized configuration for the Imagio application
 */

// Session management
export const DEFAULT_SORT_OPTION = 'createdAt' as const;
export const MAX_MAPPING_ENTRIES = 100;
export const MAPPING_MAX_AGE_MS = 5 * 60 * 1000; // 5 minutes

// UI configuration
export const MAIN_GRID_CLASS = 'main-content-three-column has-generated';
export const ERROR_NOTIFICATION_AUTO_DISMISS_SECONDS = 5;

// API configuration
export const API_TIMEOUT_MS = 30000; // 30 seconds
export const MAX_RETRIES = 3;
export const RETRY_DELAY_MS = 1000; // 1 second

// Image processing
export const DEFAULT_ASPECT_RATIO = '9:16';
export const SUPPORTED_IMAGE_FORMATS = ['jpeg', 'png', 'webp', 'gif'] as const;

// Performance
export const USE_EFFECT_DEBOUNCE_MS = 500;
export const SESSION_AUTO_SAVE_INTERVAL_MS = 10000; // 10 seconds

// File system
export const LOCAL_IMAGE_DIR_NAME = 'generated-images';
export const APP_DATA_VERSION = 1;

// Logging
export const LOG_LEVEL = process.env.NODE_ENV === 'development' ? 'debug' : 'info';

// Feature flags (for future extensibility)
export const FEATURES = {
  ERROR_REPORTING: true,
  AUTO_OPTIMIZATION: true,
  SESSION_PERSISTENCE: true,
  CLIPBOARD_MONITORING: true
} as const;
