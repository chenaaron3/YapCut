import type { CreateProgressEvent } from "~/domain/project/create-progress";

type Listener = (event: CreateProgressEvent) => void;

const listeners = new Map<string, Set<Listener>>();
const lastEvent = new Map<string, CreateProgressEvent>();

export function lastCreateProgress(
  projectId: string,
): CreateProgressEvent | undefined {
  return lastEvent.get(projectId);
}

export function subscribeCreateProgress(
  projectId: string,
  listener: Listener,
): () => void {
  let set = listeners.get(projectId);
  if (!set) {
    set = new Set();
    listeners.set(projectId, set);
  }
  set.add(listener);
  return () => {
    set!.delete(listener);
    if (set!.size === 0) listeners.delete(projectId);
  };
}

export function fanoutCreateProgress(
  projectId: string,
  event: CreateProgressEvent,
): void {
  lastEvent.set(projectId, event);
  const set = listeners.get(projectId);
  if (!set) return;
  for (const listener of set) listener(event);
}
