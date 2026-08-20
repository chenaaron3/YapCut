import type { CSSProperties } from "react";

import { containSize } from "~/domain/edit/transform";
import type { EditableTransform } from "~/editor/lib/player/use-editable-transform";
import {
  COMPOSITION_HEIGHT,
  COMPOSITION_WIDTH,
} from "~/remotion/helpers/constants";

import type { Transform } from "~/domain/edit/transform";

export const EDIT_HIT_ATTR = "data-edit-hit";

export const TRANSFORM_HANDLE_CLASS =
  "absolute h-2.5 w-2.5 rounded-sm border border-white bg-primary shadow";

export type BoxStyle = {
  widthPct: number;
  heightPct: number;
  leftPct: number;
  topPct: number;
  transform: string;
  /** Element scale — handles counter-scale by `1/scale` so they stay readable. */
  scale: number;
  base: { w: number; h: number };
};

export function clientToComp(
  clientX: number,
  clientY: number,
  rect: DOMRect,
): { x: number; y: number } {
  return {
    x: ((clientX - rect.left) / rect.width) * COMPOSITION_WIDTH,
    y: ((clientY - rect.top) / rect.height) * COMPOSITION_HEIGHT,
  };
}

export function boxStyle(editable: EditableTransform, t: Transform): BoxStyle {
  // Overlay width/height are already painted composition px (AABB measure).
  // containSize would scale them *up* to touch a frame edge — not flush.
  const base =
    editable.layer === "overlay"
      ? { w: editable.width, h: editable.height }
      : containSize(
          editable.width,
          editable.height,
          COMPOSITION_WIDTH,
          COMPOSITION_HEIGHT,
        );
  return {
    widthPct: (base.w / COMPOSITION_WIDTH) * 100,
    heightPct: (base.h / COMPOSITION_HEIGHT) * 100,
    leftPct: 50 + t.offsetX * 100,
    topPct: 50 + t.offsetY * 100,
    transform: `translate(-50%, -50%) rotate(${t.rotation}deg) scale(${t.scale})`,
    scale: t.scale,
    base,
  };
}

export function boxCss(box: BoxStyle): CSSProperties {
  return {
    width: `${box.widthPct}%`,
    height: `${box.heightPct}%`,
    left: `${box.leftPct}%`,
    top: `${box.topPct}%`,
    transform: box.transform,
    transformOrigin: "center center",
  };
}

/** Edit ids under the pointer, topmost first (`elementsFromPoint` order). */
export function editIdsFromPoint(clientX: number, clientY: number): number[] {
  const ids: number[] = [];
  const seen = new Set<number>();
  for (const el of document.elementsFromPoint(clientX, clientY)) {
    if (!(el instanceof Element)) continue;
    const host = el.closest(`[${EDIT_HIT_ATTR}]`);
    if (!host) continue;
    const raw = host.getAttribute(EDIT_HIT_ATTR);
    if (raw == null) continue;
    const id = Number(raw);
    if (!Number.isFinite(id) || seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
  }
  return ids;
}
