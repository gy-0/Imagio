import { MemoCache, memoize, debounce, throttle } from '../../utils/memoization';
import { describe, it, expect, vi } from 'vitest';

describe('Memoization utilities', () => {
  describe('MemoCache', () => {
    it('should store and retrieve values', () => {
      const cache = new MemoCache<string>(1000);
      cache.set('key1', 'value1');

      expect(cache.get('key1')).toBe('value1');
    });

    it('should return null for missing keys', () => {
      const cache = new MemoCache<string>(1000);
      expect(cache.get('nonexistent')).toBeNull();
    });

    it('should check if key exists', () => {
      const cache = new MemoCache<string>(1000);
      cache.set('key1', 'value1');

      expect(cache.has('key1')).toBe(true);
      expect(cache.has('key2')).toBe(false);
    });

    it('should clear all entries', () => {
      const cache = new MemoCache<string>(1000);
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');

      cache.clear();

      expect(cache.size()).toBe(0);
      expect(cache.get('key1')).toBeNull();
    });

    it('should expire entries after TTL', async () => {
      const cache = new MemoCache<string>(100); // 100ms TTL
      cache.set('key1', 'value1');

      expect(cache.get('key1')).toBe('value1');

      await new Promise(resolve => setTimeout(resolve, 150));

      expect(cache.get('key1')).toBeNull();
    });
  });

  describe('memoize', () => {
    it('should cache function results', () => {
      const fn = vi.fn((a: number, b: number) => a + b);
      const memoized = memoize(fn);

      const result1 = memoized(1, 2);
      const result2 = memoized(1, 2);

      expect(result1).toBe(3);
      expect(result2).toBe(3);
      expect(fn).toHaveBeenCalledTimes(1); // Called only once due to memoization
    });

    it('should differentiate between different arguments', () => {
      const fn = vi.fn((a: number) => a * 2);
      const memoized = memoize(fn);

      memoized(5);
      memoized(10);
      memoized(5);

      expect(fn).toHaveBeenCalledTimes(2); // Called for 5 and 10, but not again for 5
    });

    it('should respect maxSize option', () => {
      const fn = vi.fn((a: number) => a);
      const memoized = memoize(fn, { maxSize: 2 });

      memoized(1);
      memoized(2);
      memoized(3); // Exceeds max size, should evict first entry
      memoized(1); // Should call fn again since it was evicted

      expect(fn).toHaveBeenCalledTimes(4); // 1, 2, 3, and 1 again
    });
  });

  describe('debounce', () => {
    it('should delay function execution', async () => {
      const fn = vi.fn(() => 'result');
      const debounced = debounce(fn, 100);

      debounced();
      expect(fn).not.toHaveBeenCalled();

      await new Promise(resolve => setTimeout(resolve, 150));
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should cancel previous calls', async () => {
      const fn = vi.fn();
      const debounced = debounce(fn, 100);

      debounced();
      debounced();
      debounced();

      await new Promise(resolve => setTimeout(resolve, 150));
      expect(fn).toHaveBeenCalledTimes(1); // Only called once, not three times
    });
  });

  describe('throttle', () => {
    it('should limit function calls', () => {
      const fn = vi.fn(() => 'result');
      const throttled = throttle(fn, 100);

      throttled();
      throttled();
      throttled();

      expect(fn).toHaveBeenCalledTimes(1); // Only first call executes immediately
    });

    it('should allow calls after delay', async () => {
      const fn = vi.fn(() => 'result');
      const throttled = throttle(fn, 100);

      throttled();
      await new Promise(resolve => setTimeout(resolve, 150));
      throttled();

      expect(fn).toHaveBeenCalledTimes(2);
    });
  });
});
