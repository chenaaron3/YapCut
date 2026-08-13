type OverlaySize = { width: number; height: number };

const sizes = new Map<number, OverlaySize>();
const listeners = new Set<() => void>();
let revision = 0;

function notify(): void {
  revision += 1;
  for (const listener of listeners) listener();
}

/** Bumps when any overlay AABB measure changes (player transform hits). */
export function getOverlayMeasuresRevision(): number {
  return revision;
}

export function setOverlayMeasure(
  editId: number,
  size: OverlaySize | null,
): void {
  const prev = sizes.get(editId);
  if (size == null) {
    if (!prev) return;
    sizes.delete(editId);
    notify();
    return;
  }
  if (
    prev &&
    Math.abs(prev.width - size.width) < 0.5 &&
    Math.abs(prev.height - size.height) < 0.5
  ) {
    return;
  }
  sizes.set(editId, size);
  notify();
}

export function getOverlayMeasure(editId: number): OverlaySize | null {
  return sizes.get(editId) ?? null;
}

export function subscribeOverlayMeasures(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Placeholder until the painted pair has a measured AABB (e.g. typewriter). */
export const OVERLAY_MEASURE_FALLBACK: OverlaySize = {
  width: 720,
  height: 220,
};
