/** Painted caption/quote ink box in composition px (safe-area shell). */

export type CaptionMeasure = {
  width: number;
  height: number;
  /** Left edge of the ink box within the safe-area shell. */
  insetX: number;
};

let measure: CaptionMeasure | null = null;
const listeners = new Set<() => void>();
let revision = 0;

function notify(): void {
  revision += 1;
  for (const listener of listeners) listener();
}

export function getCaptionMeasureRevision(): number {
  return revision;
}

export function setCaptionMeasure(next: CaptionMeasure | null): void {
  if (next == null) {
    if (!measure) return;
    measure = null;
    notify();
    return;
  }
  if (
    measure &&
    Math.abs(measure.width - next.width) < 0.5 &&
    Math.abs(measure.height - next.height) < 0.5 &&
    Math.abs(measure.insetX - next.insetX) < 0.5
  ) {
    return;
  }
  measure = next;
  notify();
}

export function getCaptionMeasure(): CaptionMeasure | null {
  return measure;
}

export function subscribeCaptionMeasure(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Ink box of `shell` contents, in the shell's layout pixels. */
export function captionContentBox(shell: HTMLElement): CaptionMeasure | null {
  const shellRect = shell.getBoundingClientRect();
  if (shellRect.width < 2) return null;
  const scale = shell.offsetWidth / shellRect.width;
  const range = document.createRange();
  range.selectNodeContents(shell);
  const r = range.getBoundingClientRect();
  const width = r.width * scale;
  const height = r.height * scale;
  if (width < 2 || height < 2) return null;
  return {
    width,
    height,
    insetX: (r.left - shellRect.left) * scale,
  };
}
