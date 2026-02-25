// Session-level cache for notable events — persists across modal open/close
// Keyed by person name; populated once per session per person

export interface NotableEvent {
  year: number;
  label: string;
}

const _cache = new Map<string, NotableEvent[]>();

export const eventCache = {
  get(name: string): NotableEvent[] | undefined {
    return _cache.get(name);
  },
  set(name: string, events: NotableEvent[]): void {
    _cache.set(name, events);
  },
  has(name: string): boolean {
    return _cache.has(name);
  },
};
