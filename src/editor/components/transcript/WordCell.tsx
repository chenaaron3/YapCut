import { useState } from "react";

import { quoteSeed } from "~/domain/quote";
import { zoomSeed } from "~/domain/zoom";
import { EditMarker } from "~/editor/components/transcript/EditMarker";
import { RangeHandle } from "~/editor/components/transcript/RangeHandle";
import { WordContextMenu } from "~/editor/components/transcript/WordContextMenu";
import { chromeByKey } from "~/editor/lib/edit-chrome";
import {
  assetDropKindFromTypes,
  placeEditFromAssetDrop,
} from "~/editor/lib/place-asset-drop";
import { isSelected } from "~/editor/lib/selection";
import {
  isMarkerRole,
  resolvePrimarySpan,
} from "~/editor/lib/word-annotations";
import { useSelection } from "~/editor/selection-store";
import { useEditor } from "~/editor/store";
import { cn } from "~/lib/utils";

import type { GlobalTranscriptWord } from "~/domain/transcript";
import type { ResizeEdge } from "~/editor/components/transcript/RangeHandle";
import type { AssetDropKind } from "~/editor/lib/place-asset-drop";
import type { WordAnnotation } from "~/editor/lib/word-annotations";

type Props = {
  word: GlobalTranscriptWord;
  annotation: WordAnnotation;
  onWordDragStart?: (e: React.MouseEvent) => void;
  onResizeEdge?: (edge: ResizeEdge, editId: number) => void;
};

export function WordCell({
  word,
  annotation,
  onWordDragStart,
  onResizeEdge,
}: Props) {
  const selection = useSelection((s) => s.selection);
  const select = useSelection((s) => s.select);
  const seekTimeline = useEditor((s) => s.seekTimeline);
  const patchWord = useEditor((s) => s.patchWord);
  const placeEditOnWord = useEditor((s) => s.placeEditOnWord);
  const cutWord = useEditor((s) => s.cutWord);
  const [dropActive, setDropActive] = useState<AssetDropKind | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(word.text);

  const selected = isSelected(selection, "word", word.globalIndex);
  const markers = annotation.spans.filter((s) => isMarkerRole(s.role));
  const primary = resolvePrimarySpan(annotation.spans, selection);
  const primarySelected =
    primary != null && isSelected(selection, "edit", primary.editId);
  const primaryChrome = primary ? chromeByKey(primary.chromeKey) : null;

  const commitText = () => {
    const next = draft.trim() || word.text;
    if (next !== word.text) patchWord(word.globalIndex, { text: next });
    setEditing(false);
  };

  if (editing) {
    return (
      <input
        className="bg-panel-2 outline-accent m-0 mx-px inline rounded-sm px-0.5 py-px font-[inherit] leading-[inherit] text-[#e8eaef] text-[inherit] outline outline-2"
        value={draft}
        autoFocus
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commitText}
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commitText();
          }
          if (e.key === "Escape") {
            e.preventDefault();
            setEditing(false);
          }
        }}
        size={Math.max(2, draft.length + 1)}
      />
    );
  }

  return (
    <>
      {markers.map((span) => (
        <EditMarker
          key={`${span.chromeKey}-${span.editId}`}
          span={span}
          selected={isSelected(selection, "edit", span.editId)}
          onSelect={(editId, toggle) => select("edit", editId, toggle)}
          onDragStart={(editId) => onResizeEdge?.("start", editId)}
        />
      ))}

      <span
        className="relative inline-block"
        data-word-index={word.globalIndex}
      >
        <RangeHandle
          edge="start"
          span={primary}
          selected={primarySelected}
          onResizeEdge={onResizeEdge}
        />
        <RangeHandle
          edge="middle"
          span={primary}
          selected={primarySelected}
          onResizeEdge={onResizeEdge}
        />

        <WordContextMenu
          emphasized={!!word.emphasized}
          onEmphasis={() =>
            patchWord(word.globalIndex, { emphasized: !word.emphasized })
          }
          onZoom={() => placeEditOnWord(word.globalIndex, zoomSeed())}
          onQuote={() => placeEditOnWord(word.globalIndex, quoteSeed())}
          onDelete={() => cutWord(word.globalIndex)}
        >
          <span
            role="button"
            tabIndex={0}
            className={cn(
              "relative mx-px cursor-pointer rounded px-0.5 transition-colors select-none",
              word.inGap && "line-through opacity-40",
              word.emphasized && "font-semibold text-amber-300",
              selected && "bg-primary/35",
              !selected && primaryChrome?.underlineClass,
              primarySelected && primaryChrome?.highlightClass,
              dropActive === "broll" && "bg-broll/30 ring-broll ring-1",
              dropActive === "sfx" && "bg-sfx/30 ring-sfx ring-1",
              dropActive === "vfx" && "bg-vfx/30 ring-vfx ring-1",
            )}
            onMouseDown={(e) => onWordDragStart?.(e)}
            onClick={(e) => {
              e.stopPropagation();
              select("word", word.globalIndex, e.metaKey || e.ctrlKey);
              if (!(e.metaKey || e.ctrlKey)) seekTimeline(word.start);
            }}
            onDoubleClick={(e) => {
              e.stopPropagation();
              setDraft(word.text);
              setEditing(true);
            }}
            onDragOver={(e) => {
              const kind = assetDropKindFromTypes([...e.dataTransfer.types]);
              if (!kind) return;
              e.preventDefault();
              e.dataTransfer.dropEffect = "copy";
              setDropActive(kind);
            }}
            onDragLeave={() => setDropActive(null)}
            onDrop={(e) => {
              setDropActive(null);
              if (
                !placeEditFromAssetDrop(
                  e.dataTransfer,
                  word.globalIndex,
                  placeEditOnWord,
                )
              ) {
                return;
              }
              e.preventDefault();
              e.stopPropagation();
            }}
            onKeyDown={(e) => {
              // Space is global play/pause — only Enter activates the word.
              if (e.key === "Enter") {
                e.preventDefault();
                select("word", word.globalIndex);
                seekTimeline(word.start);
              }
            }}
          >
            {word.text}
          </span>
        </WordContextMenu>

        <RangeHandle
          edge="end"
          span={primary}
          selected={primarySelected}
          onResizeEdge={onResizeEdge}
        />
      </span>
    </>
  );
}
