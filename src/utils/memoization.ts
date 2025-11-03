/**
 * Memoization utilities for performance optimization
 * Helps cache expensive computations and async operations
 */

/**
 * Simple memoization cache with TTL support
 */
export class MemoCache<T> {
  private cache: Map<string, { value: T; timestamp: number }> = new Map();
  private ttl: number; // Time to live in milliseconds

  constructor(ttlMs: number = 5 * 60 * 1000) {
    // Default 5 minutes
    this.ttl = ttlMs;
  }

  set(key: string, value: T): void {
    this.cache.set(key, {
      value,
      timestamp: Date.now()
    });
  }

  get(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) {
      return null;
    }

    // Check if entry has expired
    if (Date.now() - entry.timestamp > this.ttl) {
      this.cache.delete(key);
      return null;
    }

    return entry.value;
  }

  has(key: string): boolean {
    return this.get(key) !== null;
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }
}

/**
 * Create a memoized version of a function
 * Caches the result based on arguments
 */
export function memoize<TArgs extends unknown[], TResult>(
  fn: (...args: TArgs) => TResult,
  options?: {
    maxSize?: number;
    keyGenerator?: (...args: TArgs) => string;
  }
): (...args: TArgs) => TResult {
  const cache = new Map<string, TResult>();
  const maxSize = options?.maxSize ?? 10;
  const keyGenerator = options?.keyGenerator ?? ((...args: TArgs) => JSON.stringify(args));

  return (...args: TArgs) => {
    const key = keyGenerator(...args);

    if (cache.has(key)) {
      return cache.get(key)!;
    }

    const result = fn(...args);

    if (cache.size >= maxSize) {
      // Remove oldest entry when cache is full
      const firstKey = cache.keys().next().value as string | undefined;
      if (firstKey !== undefined) {
        cache.delete(firstKey);
      }
    }

    cache.set(key, result);
    return result;
  };
}

/**
 * Debounce a function call
 * Useful for expensive operations triggered by frequent events
 */
export function debounce<TArgs extends unknown[], TResult>(
  fn: (...args: TArgs) => Promise<TResult> | TResult,
  delayMs: number
): (...args: TArgs) => Promise<TResult> {
  let timeoutId: NodeJS.Timeout | null = null;

  return (...args: TArgs) => {
    return new Promise((resolve, reject) => {
      if (timeoutId !== null) {
        clearTimeout(timeoutId);
      }

      timeoutId = setTimeout(() => {
        try {
          const result = fn(...args);
          if (result instanceof Promise) {
            result.then(resolve).catch(reject);
          } else {
            resolve(result);
          }
        } catch (error) {
          reject(error);
        }
      }, delayMs);
    });
  };
}

/**
 * Throttle a function call
 * Ensures function is called at most once per interval
 */
export function throttle<TArgs extends unknown[], TResult>(
  fn: (...args: TArgs) => TResult,
  delayMs: number
): (...args: TArgs) => TResult | undefined {
  let lastCallTime = 0;

  return (...args: TArgs) => {
    const now = Date.now();

    if (now - lastCallTime >= delayMs) {
      lastCallTime = now;
      return fn(...args);
    }

    return undefined;
  };
}
