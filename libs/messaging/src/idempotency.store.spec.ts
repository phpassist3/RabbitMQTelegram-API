import { InMemoryIdempotencyStore } from './idempotency.store';

describe('InMemoryIdempotencyStore', () => {
  it('reports missing ids as not seen', () => {
    const store = new InMemoryIdempotencyStore(10);
    expect(store.has('missing')).toBe(false);
  });

  it('remembers ids across calls', () => {
    const store = new InMemoryIdempotencyStore(10);
    store.remember('abc');
    expect(store.has('abc')).toBe(true);
  });

  it('does not grow on duplicate remember', () => {
    const store = new InMemoryIdempotencyStore(10);
    store.remember('abc');
    store.remember('abc');
    expect(store.size()).toBe(1);
  });

  it('evicts the oldest entry when exceeding maxSize', () => {
    const store = new InMemoryIdempotencyStore(3);
    store.remember('a');
    store.remember('b');
    store.remember('c');
    store.remember('d');

    expect(store.has('a')).toBe(false);
    expect(store.has('b')).toBe(true);
    expect(store.has('c')).toBe(true);
    expect(store.has('d')).toBe(true);
    expect(store.size()).toBe(3);
  });

  it('throws on invalid maxSize', () => {
    expect(() => new InMemoryIdempotencyStore(0)).toThrow();
  });
});
