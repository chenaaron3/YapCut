import type { ReactNode } from "react";
import { useMemo } from "react";

import { WordCell } from "~/editor/components/transcript/WordCell";
import { useRangeResize } from "~/editor/components/transcript/hooks/useRangeResize";
import { useWordDragSelect } from "~/editor/lib/use-word-drag-select";
import {
  buildWordAnnotations,
  EMPTY_WORD_ANNOTATION,
} from "~/editor/lib/word-annotations";
import { useSelection } from "~/editor/selection-store";
import { useEditor, useGlobalWords } from "~/editor/store";
import { cn } from "~/lib/utils";

export function TranscriptPanel() {
  const config = useEditor((s) => s.config);
  const dirty = useEditor((s) => s.configDirty || s.transcriptsDirty);
  const saving = useEditor((s) => s.saving);
  const words = useGlobalWords();
  const clearSelection = useSelection((s) => s.clearSelection);
  const { onDragStart } = useWordDragSelect();
  const { beginResize, consumeJustResized } = useRangeResize();

  const annotations = useMemo(
    () => buildWordAnnotations(words, config?.edits ?? []),
    [words, config?.edits],
  );

  const nodes: ReactNode[] = [];
  for (const word of words) {
    const annotation =
      annotations.get(word.globalIndex) ?? EMPTY_WORD_ANNOTATION;
    nodes.push(
      <WordCell
        key={word.globalIndex}
        word={word}
        annotation={annotation}
        onWordDragStart={(e) => onDragStart(word.globalIndex, e)}
        onResizeEdge={beginResize}
      />,
    );
  }

  return (
    <div className="flex min-h-0 min-w-0 flex-col overflow-hidden border-r border-border bg-panel">
      <div className="flex shrink-0 items-center justify-between border-b border-border px-3 py-2">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Transcript
        </span>
        <span
          className={cn(
            "text-[11px]",
            saving
              ? "text-muted-foreground"
              : dirty
                ? "text-amber-300"
                : "text-muted-foreground/70",
          )}
        >
          {saving ? "Saving…" : dirty ? "Unsaved" : "Saved"}
        </span>
      </div>
      <div
        className="min-h-0 flex-1 overflow-auto px-6 py-5 text-[18px] leading-[1.85] tracking-wide"
        onClick={() => {
          if (consumeJustResized()) return;
          clearSelection();
        }}
      >
        {words.length === 0 ? (
          <p className="text-sm text-muted-foreground">No transcript words.</p>
        ) : (
          nodes
        )}
      </div>
    </div>
  );
}
