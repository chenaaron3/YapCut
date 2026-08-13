import type { Edit, VfxEdit } from "~/domain/project-config";

function assertNever(x: never): never {
  throw new Error(`unhandled edit: ${JSON.stringify(x)}`);
}

/**
 * Structural edit identity for timeline / transcript chrome.
 * Ignores cosmetics (transform, colors, templateId, intensity, copy, …)
 * so those live patches don't re-render range UI.
 */
export function editTopologyEqual(a: Edit, b: Edit): boolean {
  if (a === b) return true;
  if (a.id !== b.id || a.start !== b.start || a.end !== b.end) return false;

  switch (a.kind) {
    case "zoom":
      return b.kind === "zoom";
    case "broll":
      return b.kind === "broll" && a.assetId === b.assetId;
    case "sfx":
      return b.kind === "sfx" && a.assetId === b.assetId;
    case "vfx":
      return b.kind === "vfx" && vfxTopologyEqual(a, b);
    default:
      return assertNever(a);
  }
}

function vfxTopologyEqual(a: VfxEdit, b: VfxEdit): boolean {
  if (a.type !== b.type) return false;

  switch (a.type) {
    case "text":
    case "listicle":
      // Correlated union: type equality doesn't narrow `b` with `a`.
      return a.middle === (b as typeof a).middle;
    case "quote":
    case "shake":
      return true;
    default:
      return assertNever(a);
  }
}

/** Zustand equality: skip notify when only cosmetic edit fields changed. */
export function editsTopologyEqual(
  a: readonly Edit[] | null | undefined,
  b: readonly Edit[] | null | undefined,
): boolean {
  if (a === b) return true;
  if (a == null || b == null) return a === b;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (!editTopologyEqual(a[i]!, b[i]!)) return false;
  }
  return true;
}
