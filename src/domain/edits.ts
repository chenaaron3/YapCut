import { produce } from "immer";

import {
  nextEditId,
  type Edit,
  type EditBase,
  type ProjectConfig,
  type TemplateStyle,
  type VfxTextEdit,
  type ZoomEdit,
} from "~/domain/project-config";
import type { TimelineTime } from "~/domain/time";

const EPS = 0.001;
const MIN_RANGE_SEC = 0.05;
export const DEFAULT_ZOOM_SCALE = 1.1;

/** Edit fields supplied at place-time (id + range filled by `placeEdit`). */
export type EditSeed = Edit extends infer E
  ? E extends Edit
    ? Omit<E, "id" | "start" | "end">
    : never
  : never;

function clampRange(
  range: TimelineTime,
  timelineDuration: number,
): TimelineTime | null {
  let s = Math.max(0, Math.min(range.start, range.end));
  let e = Math.min(timelineDuration, Math.max(range.start, range.end));
  if (e - s < MIN_RANGE_SEC) return null;
  return { start: s, end: e };
}

export function removeEdit(config: ProjectConfig, id: number): ProjectConfig {
  return produce(config, (draft) => {
    draft.edits = draft.edits.filter((e) => e.id !== id);
  });
}

export function patchEditRange(
  config: ProjectConfig,
  id: number,
  range: TimelineTime,
  timelineDuration: number,
): ProjectConfig {
  const clamped = clampRange(range, timelineDuration);
  if (!clamped) return config;
  return produce(config, (draft) => {
    const edit = draft.edits.find((e) => e.id === id);
    if (!edit) return;
    edit.start = clamped.start;
    edit.end = clamped.end;
  });
}

export function placeEdit(
  config: ProjectConfig,
  range: TimelineTime,
  timelineDuration: number,
  seed: EditSeed,
): ProjectConfig {
  const clamped = clampRange(range, timelineDuration);
  if (!clamped) return config;
  return produce(config, (draft) => {
    draft.edits.push({
      ...seed,
      id: nextEditId(draft.edits),
      start: clamped.start,
      end: clamped.end,
    } as Edit);
  });
}

export function placeZoom(
  config: ProjectConfig,
  range: TimelineTime,
  timelineDuration: number,
  scale = DEFAULT_ZOOM_SCALE,
): ProjectConfig {
  return placeEdit(config, range, timelineDuration, { kind: "zoom", scale });
}

export function placeTextVfx(
  config: ProjectConfig,
  range: TimelineTime,
  text: string,
  timelineDuration: number,
  style?: TemplateStyle,
): ProjectConfig {
  return placeEdit(config, range, timelineDuration, {
    kind: "vfx",
    type: "text",
    text,
    style,
  });
}

export function patchTextVfx(
  config: ProjectConfig,
  id: number,
  patch: Partial<Pick<VfxTextEdit, "text" | "style" | "start" | "end">>,
): ProjectConfig {
  return produce(config, (draft) => {
    const edit = draft.edits.find((e) => e.id === id);
    if (!edit || edit.kind !== "vfx" || edit.type !== "text") return;
    Object.assign(edit, patch);
  });
}

export function patchZoom(
  config: ProjectConfig,
  id: number,
  patch: Partial<Pick<ZoomEdit, "scale" | "start" | "end">>,
): ProjectConfig {
  return produce(config, (draft) => {
    const edit = draft.edits.find((e) => e.id === id);
    if (!edit || edit.kind !== "zoom") return;
    Object.assign(edit, patch);
  });
}

export function editsOverlappingRange(
  edits: readonly Edit[],
  range: TimelineTime,
): Edit[] {
  return edits.filter(
    (e) => e.start < range.end - EPS && e.end > range.start + EPS,
  );
}

export function findEditById(
  edits: readonly Edit[],
  id: number,
): Edit | undefined {
  return edits.find((e) => e.id === id);
}

export function asEditBase(edit: Edit): EditBase {
  return { id: edit.id, start: edit.start, end: edit.end };
}
