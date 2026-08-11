import type { ReactNode } from "react";
import { useMemo } from "react";
import { Settings } from "lucide-react";

import { ProjectTitleField } from "~/editor/components/ProjectTitleField";
import { InspectorPanel } from "~/editor/components/inspector/InspectorPanel";
import { TranscriptChromeVisibilityToggles } from "~/editor/components/transcript/TranscriptChromeVisibilityToggles";
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
    <div className="flex min-h-0 min-w-0 flex-col overflow-hidden border-r border-border bg-panel">
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-3 py-2">
        <ProjectTitleField />
        <div className="flex shrink-0 items-center gap-2">
          <TranscriptChromeVisibilityToggles />
          <button
            type="button"
            className={cn(
              "rounded px-1.5 py-0.5 text-[11px] transition-colors",
              projectPanel === "captions"
                ? "bg-primary/20 text-foreground"
                : "text-muted-foreground hover:bg-panel-2 hover:text-foreground",
            )}
            onClick={(e) => {
              e.stopPropagation();
              openCaptionsPanel();
            }}
          >
            Captions
          </button>
          <button
            type="button"
            className={cn(
              "rounded p-1 transition-colors",
              projectPanel === "settings"
                ? "bg-primary/20 text-foreground"
                : "text-muted-foreground hover:bg-panel-2 hover:text-foreground",
            )}
            aria-label="Project settings"
            title="Project settings"
            onClick={(e) => {
              e.stopPropagation();
              openSettingsPanel();
            }}
          >
            <Settings className="size-3.5" />
          </button>
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
              <p className="text-sm text-muted-foreground">No transcript words.</p>
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
