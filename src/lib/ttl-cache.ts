// Small in-process cache with a per-entry expiry. Used to skip repeat database round trips
// for lookups every API request makes (session, company membership). Each server instance
// has its own copy, so only cache things where a few seconds of staleness is acceptable.
export class TtlCache<V> {
  private entries = new Map<string, { value: V; expiresAt: number }>();

  constructor(private ttlMs: number, private maxEntries = 5000) {}

  get(key: string): V | undefined {
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt <= Date.now()) {
      this.entries.delete(key);
      return undefined;
    }
    return entry.value;
  }

  set(key: string, value: V) {
    if (this.entries.size >= this.maxEntries) {
      // Map keeps insertion order, so the first key is the oldest entry
      const oldest = this.entries.keys().next().value;
      if (oldest !== undefined) this.entries.delete(oldest);
    }
    this.entries.set(key, { value, expiresAt: Date.now() + this.ttlMs });
  }

  delete(key: string) {
    this.entries.delete(key);
  }

  deleteWhere(predicate: (value: V) => boolean) {
    for (const [key, entry] of this.entries) {
      if (predicate(entry.value)) this.entries.delete(key);
    }
  }
}
