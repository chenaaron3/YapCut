import { useState } from "react";

import { DEFAULT_ZOOM_SCALE } from "~/domain/edits";
import type { GlobalTranscriptWord } from "~/domain/transcript";
import { EditMarker } from "~/editor/components/transcript/EditMarker";
import { RangeHandle } from "~/editor/components/transcript/RangeHandle";
import { WordContextMenu } from "~/editor/components/transcript/WordContextMenu";
import { chromeByKey } from "~/editor/lib/edit-chrome";
import {
  assetDropKindFromTypes,
  placeEditFromAssetDrop,
  type AssetDropKind,
} from "~/editor/lib/place-asset-drop";
import { isSelected } from "~/editor/lib/selection";
import {
  isMarkerRole,
  resolvePrimarySpan,
  type WordAnnotation,
} from "~/editor/lib/word-annotations";
import { useSelection } from "~/editor/selection-store";
import { useEditor } from "~/editor/store";
import { cn } from "~/lib/utils";

type Props = {
  word: GlobalTranscriptWord;
  annotation: WordAnnotation;
  onWordDragStart?: (e: React.MouseEvent) => void;
  onResizeEdge?: (edge: "start" | "end", editId: number) => void;
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
        className="m-0 mx-[2px] inline rounded-sm bg-panel-2 px-[2px] py-px font-[inherit] text-[inherit] leading-[inherit] text-[#e8eaef] outline outline-2 outline-accent"
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

      <span className="relative inline-block" data-word-index={word.globalIndex}>
        <RangeHandle
          edge="start"
          span={primary}
          selected={primarySelected}
          onResizeEdge={onResizeEdge}
        />

        <WordContextMenu
          emphasized={!!word.emphasized}
          onEmphasis={() =>
            patchWord(word.globalIndex, { emphasized: !word.emphasized })
          }
          onZoom={() =>
            placeEditOnWord(word.globalIndex, {
              kind: "zoom",
              scale: DEFAULT_ZOOM_SCALE,
            })
          }
          onDelete={() => cutWord(word.globalIndex)}
        >
          <span
            role="button"
            tabIndex={0}
            className={cn(
              "relative mx-[2px] cursor-pointer rounded px-[2px] transition-colors select-none",
              word.inGap && "opacity-40 line-through",
              word.emphasized && "font-semibold text-amber-300",
              selected && "bg-primary/35",
              !selected && primaryChrome && primaryChrome.underlineClass,
              primarySelected && primaryChrome && primaryChrome.highlightClass,
              dropActive === "broll" && "bg-broll/30 ring-1 ring-broll",
              dropActive === "sfx" && "bg-sfx/30 ring-1 ring-sfx",
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
              if (e.key === "Enter" || e.key === " ") {
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
