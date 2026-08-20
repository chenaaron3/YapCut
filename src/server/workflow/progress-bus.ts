export type ProgressBus<Event> = {
  last(id: string): Event | undefined;
  subscribe(id: string, listener: (event: Event) => void): () => void;
  fanout(id: string, event: Event): void;
};

export function makeProgressBus<Event>(): ProgressBus<Event> {
  const listeners = new Map<string, Set<(event: Event) => void>>();
  const lastEvent = new Map<string, Event>();

  return {
    last(id) {
      return lastEvent.get(id);
    },
    subscribe(id, listener) {
      let set = listeners.get(id);
      if (!set) {
        set = new Set();
        listeners.set(id, set);
      }
      set.add(listener);
      return () => {
        set!.delete(listener);
        if (set!.size === 0) listeners.delete(id);
      };
    },
    fanout(id, event) {
      lastEvent.set(id, event);
      const set = listeners.get(id);
      if (!set) return;
      for (const listener of set) listener(event);
    },
  };
}
