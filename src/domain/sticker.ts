import catalogJson from "~/domain/sticker-catalog.json";
import { TRANSFORM_DEFAULTS } from "~/domain/transform";

import type { EditSeed } from "~/domain/edits";
import type { Edit, StickerEdit } from "~/domain/project-config";

/** DataTransfer MIME for drag-from-Assets → transcript place. */
export const STICKER_DRAG_MIME = "application/x-sticker-asset";

/**
 * Intrinsic sticker box (composition px). Stickers have no Asset row, so this
 * is the analog of b-roll natural width/height — not contain-fit / Ken Burns.
 */
export const STICKER_BOX_PX = 180;

export type StickerSource = StickerEdit["source"];

/** Paint: emoji loops, marks play intro then hold. */
export type StickerPlayback = "loop" | "hold";

/** Library thumb — emoji is a Unicode glyph; marks are a still SVG. */
export type StickerPreview =
  | { kind: "glyph"; glyph: string }
  | { kind: "image"; src: string };

export type StickerCatalogEntry = {
  id: string;
  source: StickerSource;
  label: string;
  playback: StickerPlayback;
  /** Path from `public/` (derived from source + id). */
  file: string;
  preview: StickerPreview;
  /** Mixed Popular tab. */
  popular: boolean;
};

export type StickerDragPayload = {
  source: StickerSource;
  catalogId: string;
};

/** Place-time pose: small, upper-right of the talking head. */
export const STICKER_TRANSFORM_DEFAULTS = {
  ...TRANSFORM_DEFAULTS,
  offsetX: 0.18,
  offsetY: -0.22,
} as const;

type StickerCatalogRow = {
  id: string;
  source: StickerSource;
  label: string;
  glyph?: string;
  popular?: boolean;
};

function hydrate(row: StickerCatalogRow): StickerCatalogEntry {
  if (row.source === "emoji") {
    return {
      id: row.id,
      source: "emoji",
      label: row.label,
      playback: "loop",
      file: `stickers/emoji/${row.id}.json`,
      preview: { kind: "glyph", glyph: row.glyph ?? "◻" },
      popular: row.popular === true,
    };
  }
  return {
    id: row.id,
    source: "lordicon",
    label: row.label,
    playback: "hold",
    file: `stickers/lordicon/${row.id}.json`,
    preview: { kind: "image", src: `stickers/lordicon/${row.id}.svg` },
    popular: row.popular === true,
  };
}

/** Catalog ids must match files under `public/stickers/` — see that folder’s README. */
export const STICKER_CATALOG: readonly StickerCatalogEntry[] = (
  catalogJson as StickerCatalogRow[]
).map(hydrate);

export const EMOJI_STICKERS: readonly StickerCatalogEntry[] =
  STICKER_CATALOG.filter((e) => e.source === "emoji");

export const LORDICON_STICKERS: readonly StickerCatalogEntry[] =
  STICKER_CATALOG.filter((e) => e.source === "lordicon");

const STICKER_BY_KEY = new Map(
  STICKER_CATALOG.map((entry) => [`${entry.source}:${entry.id}`, entry]),
);

export function isStickerEdit(edit: Edit): edit is StickerEdit {
  return edit.kind === "sticker";
}

export function stickerEntry(
  source: StickerSource,
  catalogId: string,
): StickerCatalogEntry | undefined {
  return STICKER_BY_KEY.get(`${source}:${catalogId}`);
}

export function stickerLabel(
  edit: Pick<StickerEdit, "source" | "catalogId">,
): string {
  return stickerEntry(edit.source, edit.catalogId)?.label ?? "Sticker";
}

export function stickerMatchesQuery(
  entry: StickerCatalogEntry,
  query: string,
): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return (
    entry.label.toLowerCase().includes(q) ||
    entry.id.toLowerCase().includes(q) ||
    entry.source.toLowerCase().includes(q)
  );
}

/** Place-time defaults for a sticker (range filled by `placeEdit`). */
export function stickerSeed(
  source: StickerSource,
  catalogId: string,
): Extract<EditSeed, { kind: "sticker" }> {
  return {
    kind: "sticker",
    source,
    catalogId,
    ...STICKER_TRANSFORM_DEFAULTS,
  };
}
