import type { EditId } from "~/domain/project-config";

export type SelectionKind = "word" | "edit" | "aroll";

export type Selection =
  | { kind: "word"; ids: number[] }
  | { kind: "edit"; ids: EditId[] }
  /** `ids` are unique layout cell ids from `buildArollLayout`. */
  | { kind: "aroll"; ids: number[] };

export function isSelected(
  selection: Selection | null | undefined,
  kind: SelectionKind,
  id: number,
): boolean {
  if (!selection || selection.kind !== kind) return false;
  return selection.ids.includes(id);
}

export function primaryId(selection: Selection | null | undefined): number | null {
  if (!selection || selection.ids.length === 0) return null;
  return selection.ids[selection.ids.length - 1]!;
}

export function replaceSelection(
  kind: SelectionKind,
  ids: readonly number[],
): Selection | null {
  const unique = [...new Set(ids)];
  if (unique.length === 0) return null;
  return { kind, ids: unique } as Selection;
}

export function toggleSelection(
  current: Selection | null,
  kind: SelectionKind,
  id: number,
): Selection | null {
  if (current?.kind !== kind) {
    return { kind, ids: [id] } as Selection;
  }

  const next = [...current.ids];
  const i = next.indexOf(id);
  if (i >= 0) next.splice(i, 1);
  else next.push(id);
  return next.length === 0 ? null : ({ kind, ids: next } as Selection);
}

export function selectWordRange(start: number, end: number): Selection {
  const lo = Math.min(start, end);
  const hi = Math.max(start, end);
  return {
    kind: "word",
    ids: Array.from({ length: hi - lo + 1 }, (_, i) => lo + i),
  };
}
