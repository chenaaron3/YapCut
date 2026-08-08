import { DEFAULT_ZOOM_SCALE } from "~/domain/edits";
import type { GlobalTranscriptWord } from "~/domain/transcript";
import { EditMarker } from "~/editor/components/transcript/EditMarker";
import { RangeHandle } from "~/editor/components/transcript/RangeHandle";
import { WordContextMenu } from "~/editor/components/transcript/WordContextMenu";
import { chromeByKey } from "~/editor/lib/edit-chrome";
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

  const selected = isSelected(selection, "word", word.globalIndex);
  const markers = annotation.spans.filter((s) => isMarkerRole(s.role));
  const primary = resolvePrimarySpan(annotation.spans, selection);
  const primarySelected =
    primary != null && isSelected(selection, "edit", primary.editId);
  const primaryChrome = primary ? chromeByKey(primary.chromeKey) : null;

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
              word.emphasized && "font-semibold text-amber-300",
              selected && "bg-primary/35",
              !selected && primaryChrome && primaryChrome.underlineClass,
              primarySelected && primaryChrome && primaryChrome.highlightClass,
            )}
            onMouseDown={(e) => onWordDragStart?.(e)}
            onClick={(e) => {
              e.stopPropagation();
              select("word", word.globalIndex, e.metaKey || e.ctrlKey);
              if (!(e.metaKey || e.ctrlKey)) seekTimeline(word.start);
            }}
            onDoubleClick={(e) => {
              e.stopPropagation();
              patchWord(word.globalIndex, { emphasized: !word.emphasized });
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
