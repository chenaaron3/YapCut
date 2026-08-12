import type { ArollLayoutCell } from "~/domain/arolls";
import type { ProjectConfig } from "~/domain/project-config";
import type { GlobalTranscriptWord } from "~/domain/transcript";
import { selectedArollAssetRun } from "~/editor/lib/aroll-asset-selection";

/** Opaque selection key — numeric for word/edit/aroll cells, string for asset ids. */
export type SelectionId = number | string;

export type SelectionKind = "word" | "edit" | "aroll" | "arollAsset";

export type Selection = {
  kind: SelectionKind;
  ids: SelectionId[];
};

/** Project-field inspector panels (not entity selections). */
export type ProjectPanel = "captions" | "settings" | "music";

/** Editor slices needed for A-roll asset selection fallbacks. */
export type IsSelectedEditor = {
  config: ProjectConfig | null;
  assets: ReadonlyArray<{ id: string; durationSec: number | null }>;
  getGlobalWords: () => readonly GlobalTranscriptWord[];
  getLayout: () => readonly ArollLayoutCell[];
};

/**
 * True when `id` is selected as `kind`, or (with `editor`) when an A-roll
 * asset selection owns that entity (word/aroll by assetId; edit by start-in-run).
 */
export function isSelected(
  selection: Selection | null | undefined,
  kind: SelectionKind,
  id: SelectionId,
  editor?: IsSelectedEditor,
): boolean {
  if (!selection) return false;
  if (selection.kind === kind) {
    return selection.ids.includes(id);
  }
  if (selection.kind !== "arollAsset" || !editor) return false;

  const durations = new Map(
    editor.assets.map((a) => [a.id, a.durationSec ?? 0]),
  );

  if (kind === "edit" && typeof id === "number") {
    const edit = editor.config?.edits.find((e) => e.id === id);
    if (!edit) return false;
    const run = selectedArollAssetRun(selection, editor.config, durations);
    return run != null && edit.start >= run.start && edit.start < run.end;
  }

  if (kind === "word" && typeof id === "number") {
    const word = editor.getGlobalWords()[id];
    return word != null && selection.ids.includes(word.assetId);
  }

  if (kind === "aroll" && typeof id === "number") {
    const cell = editor.getLayout().find((c) => c.id === id);
    return cell != null && selection.ids.includes(cell.local.assetId);
  }

  return false;
}

/** Last selected numeric id, if any (ignores string asset ids). */
export function primaryId(
  selection: Selection | null | undefined,
): number | null {
  if (!selection || selection.ids.length === 0) return null;
  const id = selection.ids[selection.ids.length - 1]!;
  return typeof id === "number" ? id : null;
}

export function replaceSelection(
  kind: SelectionKind,
  ids: readonly SelectionId[],
): Selection | null {
  const unique = [...new Set(ids)];
  if (unique.length === 0) return null;
  return { kind, ids: unique };
}

export function toggleSelection(
  current: Selection | null,
  kind: SelectionKind,
  id: SelectionId,
): Selection | null {
  if (current?.kind !== kind) {
    return { kind, ids: [id] };
  }

  const next = [...current.ids];
  const i = next.indexOf(id);
  if (i >= 0) next.splice(i, 1);
  else next.push(id);
  return next.length === 0 ? null : { kind, ids: next };
}

export function selectWordRange(start: number, end: number): Selection {
  const lo = Math.min(start, end);
  const hi = Math.max(start, end);
  return {
    kind: "word",
    ids: Array.from({ length: hi - lo + 1 }, (_, i) => lo + i),
  };
}
