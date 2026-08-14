import { memo, useState } from "react";

import { quoteSeed } from "~/domain/quote";
import { isValidTransitionDropWord } from "~/domain/transition";
import { zoomSeed } from "~/domain/zoom";
import { EditMarkerCluster } from "~/editor/components/transcript/EditMarkerCluster";
import { RangeHandle } from "~/editor/components/transcript/RangeHandle";
import { WordContextMenu } from "~/editor/components/transcript/WordContextMenu";
import { WordGap } from "~/editor/components/transcript/WordGap";
import { chromeByKey } from "~/editor/lib/edit-chrome";
import {
  assetDropKindFromTypes,
  placeEditFromAssetDrop,
} from "~/editor/lib/place-asset-drop";
import { isChromeKeyVisible } from "~/editor/lib/transcript-chrome-visibility";
import { useEntitySelected } from "~/editor/lib/use-is-selected";
import {
  isAfterMarkerRole,
  isMarkerRole,
  resolvePrimarySpan,
} from "~/editor/lib/word-annotations";
import { useSelection } from "~/editor/selection-store";
import { useEditor } from "~/editor/store";
import { useTranscriptUi } from "~/editor/transcript-ui-store";
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
  /** Valid transition drop while a Transitions-tab drag is in flight. */
  transitionDropGlow?: boolean;
};

export const WordCell = memo(function WordCell({
  word,
  annotation,
  onWordDragStart,
  onResizeEdge,
  transitionDropGlow = false,
}: Props) {
  const select = useSelection((s) => s.select);
  const seekTimeline = useEditor((s) => s.seekTimeline);
  const patchWord = useEditor((s) => s.patchWord);
  const placeEditOnWord = useEditor((s) => s.placeEditOnWord);
  const cutWord = useEditor((s) => s.cutWord);
  const [dropActive, setDropActive] = useState<AssetDropKind | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(word.text);

  const chromeVisible = useTranscriptUi((s) => s.visible);

  const selected = useEntitySelected("word", word.globalIndex, word.assetId);

  const visibleSpans = annotation.spans.filter((s) =>
    isChromeKeyVisible(s.chromeKey, chromeVisible),
  );
  const markers = visibleSpans.filter((s) => isMarkerRole(s.role));
  const beforeMarkers = markers.filter((s) => !isAfterMarkerRole(s.role));
  const afterMarkers = markers.filter((s) => isAfterMarkerRole(s.role));

  // Only re-render when the primary edit for this word changes — word playback
  // selection does not affect chrome primary resolution.
  const primaryEditId = useSelection((s) => {
    return resolvePrimarySpan(visibleSpans, s.selection)?.editId ?? null;
  });
  const primary =
    primaryEditId != null
      ? (visibleSpans.find((s) => s.editId === primaryEditId) ?? null)
      : null;
  const editSelected = useEntitySelected("edit", primaryEditId ?? -1);
  const primarySelected = primaryEditId != null && editSelected;
  const primaryChrome = primary ? chromeByKey(primary.chromeKey) : null;

  const commitText = () => {
    const next = draft.trim() || word.text;
    if (next !== word.text) patchWord(word.globalIndex, { text: next });
    setEditing(false);
  };

  const handleSelected =
    primarySelected && primary != null && primary.chromeKey !== "transition";

  if (editing) {
    return (
      <>
        <WordGap />
        <input
          className="bg-panel-2 outline-accent m-0 inline rounded-sm py-px font-[inherit] leading-[inherit] text-[#e8eaef] text-[inherit] outline outline-2"
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
        <WordGap />
      </>
    );
  }

  return (
    <>
      <EditMarkerCluster
        clusterId={`${word.globalIndex}:before`}
        markers={beforeMarkers}
        onSelect={(editId, toggle) => select("edit", editId, toggle)}
        onDragStart={(editId) => {
          const span = beforeMarkers.find((s) => s.editId === editId);
          if (span?.chromeKey === "transition") return;
          onResizeEdge?.("start", editId);
        }}
      />

      <WordGap>
        <RangeHandle
          edge="start"
          span={primary}
          selected={handleSelected}
          onResizeEdge={onResizeEdge}
        />
      </WordGap>

      <span
        className="relative inline-block"
        data-word-index={word.globalIndex}
      >
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
              "relative cursor-pointer rounded transition-colors select-none",
              word.inGap && "line-through opacity-40",
              word.emphasized && "font-semibold text-amber-300",
              selected && "bg-primary/35",
              // Underline only when the primary edit is selected — idle markers carry the signal.
              primarySelected && primary != null && primaryChrome?.underlineClass,
              primarySelected && primary != null && primaryChrome?.highlightClass,
              dropActive === "broll" && "bg-broll/30 ring-broll ring-1",
              dropActive === "sfx" && "bg-sfx/30 ring-sfx ring-1",
              dropActive === "vfx" && "bg-vfx/30 ring-vfx ring-1",
              dropActive === "transition" &&
                "bg-transition/40 ring-transition ring-1",
              transitionDropGlow &&
                dropActive !== "transition" &&
                "animate-transition-drop-glow",
            )}
            onMouseDown={(e) => {
              // Drag-select applies a word range on mousedown — skip when an
              // edit covering this word is selected so the edit stays selected.
              if (primarySelected) return;
              onWordDragStart?.(e);
            }}
            onClick={(e) => {
              e.stopPropagation();
              // Keep edit selection when clicking inside its range.
              if (primarySelected) {
                if (!(e.metaKey || e.ctrlKey)) seekTimeline(word.start);
                return;
              }
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
              if (kind === "transition") {
                const state = useEditor.getState();
                if (
                  !isValidTransitionDropWord(
                    word.globalIndex,
                    state.getGlobalWords(),
                    state.getLayout(),
                  )
                ) {
                  return;
                }
              }
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
                if (primarySelected) {
                  seekTimeline(word.start);
                  return;
                }
                select("word", word.globalIndex);
                seekTimeline(word.start);
              }
            }}
          >
            {word.text}
          </span>
        </WordContextMenu>
      </span>

      <WordGap>
        <RangeHandle
          edge="middle"
          span={primary}
          selected={handleSelected}
          onResizeEdge={onResizeEdge}
        />
        <RangeHandle
          edge="end"
          span={primary}
          selected={handleSelected}
          onResizeEdge={onResizeEdge}
        />
      </WordGap>
      <EditMarkerCluster
        clusterId={`${word.globalIndex}:after`}
        markers={afterMarkers}
        onSelect={(editId, toggle) => select("edit", editId, toggle)}
      />
    </>
  );
});
