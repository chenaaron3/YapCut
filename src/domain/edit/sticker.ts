import catalogJson from "~/domain/edit/sticker-catalog.json";
import { TRANSFORM_DEFAULTS } from "~/domain/edit/transform";

import type { EditSeed } from "~/domain/edit/edits";
import type { Edit, StickerEdit } from "~/domain/project/project-config";

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

export const EMOJI_TOPIC_ORDER = [
  "smileys-emotion",
  "people-body",
  "animals-nature",
  "food-drink",
  "travel-places",
  "activities",
  "objects",
  "symbols",
  "flags",
  "component",
] as const;
export type EmojiTopic = (typeof EMOJI_TOPIC_ORDER)[number];

export const LORDICON_TOPIC_ORDER = [
  "ui",
  "people",
  "media",
  "business",
  "tech",
  "objects",
] as const;
export type LordiconTopic = (typeof LORDICON_TOPIC_ORDER)[number];

export const EMOJI_TOPIC_LABELS: Record<EmojiTopic, string> = {
  "smileys-emotion": "Smileys",
  "people-body": "People & body",
  "animals-nature": "Animals & nature",
  "food-drink": "Food & drink",
  "travel-places": "Travel & places",
  activities: "Activities",
  objects: "Objects",
  symbols: "Symbols",
  flags: "Flags",
  component: "Component",
};

export const LORDICON_TOPIC_LABELS: Record<LordiconTopic, string> = {
  ui: "UI",
  people: "People",
  media: "Media",
  business: "Business",
  tech: "Tech",
  objects: "Other",
};

export type StickerCatalogEntry = {
  id: string;
  source: StickerSource;
  label: string;
  playback: StickerPlayback;
  /** Path from `public/` (derived from source + topic + id). */
  file: string;
  preview: StickerPreview;
  /** Mixed Popular tab. */
  popular: boolean;
  topic: string;
};

export type StickerTopicGroup = {
  key: string;
  source: StickerSource;
  topic: string;
  label: string;
  entries: StickerCatalogEntry[];
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
  /** Folder under `public/stickers/{source}/`. Required. */
  topic: string;
};

const TOPIC_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function stickerPath(source: StickerSource, topic: string, id: string, ext: "json" | "svg"): string {
  if (!TOPIC_SLUG.test(topic)) {
    throw new Error(`sticker topic must be a slug: ${source}:${id} topic=${topic}`);
  }
  return `stickers/${source}/${topic}/${id}.${ext}`;
}

function hydrate(row: StickerCatalogRow): StickerCatalogEntry {
  if (row.source === "emoji") {
    return {
      id: row.id,
      source: "emoji",
      label: row.label,
      playback: "loop",
      file: stickerPath("emoji", row.topic, row.id, "json"),
      preview: { kind: "glyph", glyph: row.glyph ?? "◻" },
      popular: row.popular === true,
      topic: row.topic,
    };
  }
  return {
    id: row.id,
    source: "lordicon",
    label: row.label,
    playback: "hold",
    file: stickerPath("lordicon", row.topic, row.id, "json"),
    preview: {
      kind: "image",
      src: stickerPath("lordicon", row.topic, row.id, "svg"),
    },
    popular: row.popular === true,
    topic: row.topic,
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

export function stickerTopicLabel(
  source: StickerSource,
  topic: string,
): string {
  if (source === "emoji") {
    if (topic in EMOJI_TOPIC_LABELS) {
      return EMOJI_TOPIC_LABELS[topic as EmojiTopic];
    }
  } else if (topic in LORDICON_TOPIC_LABELS) {
    return LORDICON_TOPIC_LABELS[topic as LordiconTopic];
  }
  return topic;
}

function topicOrderIndex(source: StickerSource, topic: string): number {
  const order =
    source === "emoji" ? EMOJI_TOPIC_ORDER : LORDICON_TOPIC_ORDER;
  const idx = (order as readonly string[]).indexOf(topic);
  return idx === -1 ? order.length : idx;
}

/** Group catalog rows by source + topic. Emoji groups first, then Marks. */
export function groupStickersByTopic(
  entries: readonly StickerCatalogEntry[],
): StickerTopicGroup[] {
  const buckets = new Map<string, StickerCatalogEntry[]>();
  for (const entry of entries) {
    const key = `${entry.source}:${entry.topic}`;
    const list = buckets.get(key);
    if (list) list.push(entry);
    else buckets.set(key, [entry]);
  }

  const groups: StickerTopicGroup[] = [];
  for (const source of ["emoji", "lordicon"] as const) {
    const sourceBuckets = [...buckets.entries()].filter(([key]) =>
      key.startsWith(`${source}:`),
    );
    sourceBuckets.sort(
      ([, a], [, b]) =>
        topicOrderIndex(source, a[0]!.topic) -
        topicOrderIndex(source, b[0]!.topic),
    );
    for (const [key, list] of sourceBuckets) {
      const topic = list[0]!.topic;
      groups.push({
        key,
        source,
        topic,
        label: stickerTopicLabel(source, topic),
        entries: list,
      });
    }
  }
  return groups;
}

export function stickerMatchesQuery(
  entry: StickerCatalogEntry,
  query: string,
): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const topicLabel = stickerTopicLabel(entry.source, entry.topic);
  return (
    entry.label.toLowerCase().includes(q) ||
    entry.id.toLowerCase().includes(q) ||
    entry.source.toLowerCase().includes(q) ||
    entry.topic.toLowerCase().includes(q) ||
    topicLabel.toLowerCase().includes(q)
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
