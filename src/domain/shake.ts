import type { Edit, VfxShakeEdit } from "~/domain/project-config";

/** Default shake amplitude as a fraction of composition size. */
export const DEFAULT_SHAKE_INTENSITY = 0.014;
export const SHAKE_INTENSITY_MIN = 0.002;
export const SHAKE_INTENSITY_MAX = 0.06;

export function isShakeEdit(edit: Edit): edit is VfxShakeEdit {
  return edit.kind === "vfx" && edit.type === "shake";
}

export function clampShakeIntensity(intensity: number): number {
  return Math.min(
    SHAKE_INTENSITY_MAX,
    Math.max(SHAKE_INTENSITY_MIN, intensity),
  );
}

export function resolveShakeIntensity(intensity: number | undefined): number {
  return intensity ?? DEFAULT_SHAKE_INTENSITY;
}

export function withShakeIntensity<T extends { intensity?: number }>(
  edit: T,
  intensity: number,
): T {
  return { ...edit, intensity: clampShakeIntensity(intensity) };
}

/** Place-time defaults (range filled by `placeEdit`). Intensity omitted = default. */
export function shakeSeed(): { kind: "vfx"; type: "shake" } {
  return {
    kind: "vfx",
    type: "shake",
  };
}
