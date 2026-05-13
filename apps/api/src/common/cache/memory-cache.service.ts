import { Injectable } from "@nestjs/common";

/**
 * Tiny per-instance LRU-ish cache. On Vercel each serverless function holds
 * its own copy; cache hits within the same warm instance avoid DB hits during
 * a traffic spike. Falls back transparently — never throws.
 *
 * For multi-instance shared cache, swap this for Redis (not available here).
 */
@Injectable()
export class MemoryCacheService {
  private store = new Map<string, { value: unknown; expiresAt: number }>();
  private pending = new Map<string, Promise<unknown>>();
  private maxSize = 1000;

  get<T>(key: string): T | null {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (entry.expiresAt < Date.now()) {
      this.store.delete(key);
      return null;
    }
    // refresh LRU order
    this.store.delete(key);
    this.store.set(key, entry);
    return entry.value as T;
  }

  set<T>(key: string, value: T, ttlSeconds: number): void {
    if (this.store.size >= this.maxSize) {
      const firstKey = this.store.keys().next().value;
      if (firstKey) this.store.delete(firstKey);
    }
    this.store.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
  }

  async getOrSet<T>(
    key: string,
    ttlSeconds: number,
    loader: () => Promise<T>,
  ): Promise<T> {
    const cached = this.get<T>(key);
    if (cached !== null) return cached;

    return this.runPending(key, async () => {
      const value = await loader();
      this.set(key, value, ttlSeconds);
      return value;
    });
  }

  async getStaleWhileRevalidate<T>(
    key: string,
    softTtlSeconds: number,
    hardTtlSeconds: number,
    loader: () => Promise<T>,
  ): Promise<T> {
    const cached = this.get<{ value: T; refreshedAt: number }>(key);
    if (cached !== null) {
      const ageMs = Date.now() - cached.refreshedAt;
      if (ageMs > softTtlSeconds * 1000) {
        void this.refreshStaleEntry(key, hardTtlSeconds, loader).catch(() => undefined);
      }
      return cached.value;
    }

    return this.refreshStaleEntry(key, hardTtlSeconds, loader);
  }

  del(key: string): void {
    this.store.delete(key);
  }

  delPrefix(prefix: string): void {
    for (const k of this.store.keys()) if (k.startsWith(prefix)) this.store.delete(k);
  }

  private async refreshStaleEntry<T>(
    key: string,
    hardTtlSeconds: number,
    loader: () => Promise<T>,
  ): Promise<T> {
    return this.runPending(`swr:${key}`, async () => {
      const value = await loader();
      this.set(key, { value, refreshedAt: Date.now() }, hardTtlSeconds);
      return value;
    });
  }

  private async runPending<T>(key: string, loader: () => Promise<T>): Promise<T> {
    const existing = this.pending.get(key) as Promise<T> | undefined;
    if (existing) return existing;

    const promise = loader().finally(() => {
      this.pending.delete(key);
    });
    this.pending.set(key, promise);
    return promise;
  }
}
