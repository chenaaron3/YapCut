import { useMemo, useState } from "react";

import {
  STICKER_CATALOG,
  STICKER_DRAG_MIME,
  groupStickersByTopic,
  stickerMatchesQuery,
} from "~/domain/edit/sticker";
import { InspectorCollapsible } from "~/editor/components/inspector/field/InspectorCollapsible";
import {
  PickerEmpty,
  PickerGrid,
  PickerTile,
} from "~/editor/components/picker";
import {
  beginAssetPlaceDrag,
  endAssetPlaceDrag,
} from "~/editor/lib/place/asset-place-drag";
import { cn } from "~/lib/utils";

import type { StickerCatalogEntry, StickerDragPayload } from "~/domain/edit/sticker";

type StickerTab = "popular" | "emoji" | "marks" | "all";

const TABS: { id: StickerTab; label: string }[] = [
  { id: "popular", label: "Popular" },
  { id: "emoji", label: "Emoji" },
  { id: "marks", label: "Marks" },
  { id: "all", label: "All" },
];

function tabEntries(
  tab: StickerTab,
  query: string,
): readonly StickerCatalogEntry[] {
  const q = query.trim();
  const pool = q
    ? STICKER_CATALOG.filter((e) => stickerMatchesQuery(e, q))
    : tab === "popular"
      ? STICKER_CATALOG.filter((e) => e.popular)
      : tab === "emoji"
        ? STICKER_CATALOG.filter((e) => e.source === "emoji")
        : tab === "marks"
          ? STICKER_CATALOG.filter((e) => e.source === "lordicon")
          : STICKER_CATALOG;
  return pool;
}

function StickerTile({ entry }: { entry: StickerCatalogEntry }) {
  const payload: StickerDragPayload = {
    source: entry.source,
    catalogId: entry.id,
  };
  return (
    <PickerTile
      label={entry.label}
      draggable
      thumbClassName="bg-sticker/20"
      onDragStart={(e) => {
        e.dataTransfer.setData(STICKER_DRAG_MIME, JSON.stringify(payload));
        beginAssetPlaceDrag(e, "sticker", "sticker");
      }}
      onDragEnd={endAssetPlaceDrag}
    >
      {entry.preview.kind === "glyph" ? (
        <span className="text-lg leading-none">{entry.preview.glyph}</span>
      ) : (
        <img
          src={`/${entry.preview.src}`}
          alt=""
          draggable={false}
          className="size-7 object-contain"
        />
      )}
    </PickerTile>
  );
}

export function StickerLibrary() {
  const [tab, setTab] = useState<StickerTab>("popular");
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const searching = query.trim().length > 0;
  const entries = useMemo(() => tabEntries(tab, query), [tab, query]);
  const groups = useMemo(() => groupStickersByTopic(entries), [entries]);

  return (
    <div className="flex flex-col">
      <div className="bg-panel sticky top-0 z-10 flex flex-col gap-1.5 border-b border-[#2A2F3C] px-2 pt-2 pb-2">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search stickers"
          className="border-border bg-panel-2 w-full rounded-md border px-2 py-1 text-[11px] text-[#F5F9CE] outline-none placeholder:text-[#8B90A0]"
        />
        <div role="tablist" aria-label="Sticker sets" className="flex gap-1">
          {TABS.map(({ id, label }) => {
            const active = !searching && tab === id;
            return (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={active}
                className={cn(
                  "ember-mono rounded px-1.5 py-0.5 text-[9px] font-medium tracking-[.12em] uppercase",
                  active
                    ? "bg-sticker/25 text-[#F5F9CE]"
                    : "text-[#C8CDD8] hover:text-[#F5F9CE]",
                )}
                onClick={() => {
                  setTab(id);
                  setQuery("");
                }}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>
      <div className="px-2 pb-2">
        {groups.map((group) => {
          const isOpen = searching ? true : (open[group.key] ?? false);
          return (
            <InspectorCollapsible
              key={group.key}
              title={group.label}
              open={isOpen}
              onOpenChange={(next) =>
                setOpen((prev) => ({ ...prev, [group.key]: next }))
              }
              accessory={
                <span className="text-[10px] text-muted-foreground/70">
                  {group.entries.length}
                </span>
              }
              contentClassName="gap-0 pt-2"
            >
              <PickerGrid>
                {group.entries.map((entry) => (
                  <StickerTile
                    key={`${entry.source}:${entry.id}`}
                    entry={entry}
                  />
                ))}
              </PickerGrid>
            </InspectorCollapsible>
          );
        })}
        {groups.length === 0 ? (
          <PickerEmpty>No stickers match.</PickerEmpty>
        ) : null}
      </div>
    </div>
  );
}
