export interface IdempotencyStore {
  has(id: string): boolean;
  remember(id: string): void;
}

/**
 * Bounded in-memory store with FIFO eviction. Suitable for a single instance.
 * For horizontally scaled deployments swap with a Redis/Postgres backed store.
 */
export class InMemoryIdempotencyStore implements IdempotencyStore {
  private readonly cache = new Set<string>();

  constructor(private readonly maxSize: number) {
    if (maxSize < 1) throw new Error('idempotency cache size must be >= 1');
  }

  has(id: string): boolean {
    return this.cache.has(id);
  }

  remember(id: string): void {
    if (this.cache.has(id)) return;
    if (this.cache.size >= this.maxSize) {
      const oldest = this.cache.values().next().value;
      if (oldest !== undefined) this.cache.delete(oldest);
    }
    this.cache.add(id);
  }

  size(): number {
    return this.cache.size;
  }
}
