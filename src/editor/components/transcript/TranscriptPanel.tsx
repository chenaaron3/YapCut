import { Captions, Settings2 } from "lucide-react";
import { useMemo } from "react";

import { InspectorPanel } from "~/editor/components/inspector/InspectorPanel";
import { ProjectTitleField } from "~/editor/components/ProjectTitleField";
import { useRangeResize } from "~/editor/components/transcript/hooks/useRangeResize";
import { TranscriptChromeVisibilityToggles } from "~/editor/components/transcript/TranscriptChromeVisibilityToggles";
import { WordCell } from "~/editor/components/transcript/WordCell";
import { useWordDragSelect } from "~/editor/lib/use-word-drag-select";
import {
  buildWordAnnotations,
  EMPTY_WORD_ANNOTATION,
} from "~/editor/lib/word-annotations";
import { useSelection } from "~/editor/selection-store";
import { useEditor, useGlobalWords } from "~/editor/store";
import { cn } from "~/lib/utils";

import type { ReactNode } from "react";

export function TranscriptPanel() {
  const config = useEditor((s) => s.config);
  const words = useGlobalWords();
  const projectPanel = useSelection((s) => s.projectPanel);
  const clearSelection = useSelection((s) => s.clearSelection);
  const openCaptionsPanel = useSelection((s) => s.openCaptionsPanel);
  const openSettingsPanel = useSelection((s) => s.openSettingsPanel);
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
    <div className="border-border bg-panel flex min-h-0 min-w-0 flex-col overflow-hidden border-r">
      <div className="border-border flex shrink-0 items-center justify-between gap-3 border-b px-3 py-2">
        <ProjectTitleField />
        <div className="flex shrink-0 items-center gap-2">
          <TranscriptChromeVisibilityToggles />
          <button
            type="button"
            className={cn(
              "inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-xs font-medium transition-colors",
              projectPanel === "captions"
                ? "bg-primary/20 text-foreground"
                : "text-muted-foreground hover:bg-panel-2 hover:text-foreground",
            )}
            title="Open caption style inspector"
            onClick={(e) => {
              e.stopPropagation();
              openCaptionsPanel();
            }}
          >
            <Captions className="size-3.5" />
            Captions
          </button>
          <button
            type="button"
            className={cn(
              "inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-xs font-medium transition-colors",
              projectPanel === "settings"
                ? "bg-primary/20 text-foreground"
                : "text-muted-foreground hover:bg-panel-2 hover:text-foreground",
            )}
            title="Project settings"
            onClick={(e) => {
              e.stopPropagation();
              openSettingsPanel();
            }}
          >
            <Settings2 className="size-3.5" />
            Settings
          </button>
        </div>
      </div>
      <div className="flex min-h-0 min-w-0 flex-1 overflow-hidden">
        <div
          className="min-h-0 min-w-0 flex-[3] overflow-auto"
          onClick={() => {
            if (consumeJustResized()) return;
            clearSelection();
          }}
        >
          <div className="px-6 py-5 text-[18px] leading-[1.85]">
            {words.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                No transcript words.
              </p>
            ) : (
              nodes
            )}
          </div>
        </div>
        <InspectorPanel />
      </div>
    </div>
  );
}
