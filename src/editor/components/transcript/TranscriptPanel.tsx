import { Captions, Settings2 } from "lucide-react";
import { useMemo } from "react";

import { buildArollLayoutFromAssets } from "~/domain/arolls";
import { validTransitionDrops } from "~/domain/transition";
import { InspectorPanel } from "~/editor/components/inspector/InspectorPanel";
import { ProjectTitleField } from "~/editor/components/ProjectTitleField";
import { useRangeResize } from "~/editor/components/transcript/hooks/useRangeResize";
import { TranscriptChromeVisibilityToggles } from "~/editor/components/transcript/TranscriptChromeVisibilityToggles";
import { WordCell } from "~/editor/components/transcript/WordCell";
import { editsTopologyEqual } from "~/editor/lib/edit-topology";
import { useWordDragSelect } from "~/editor/lib/use-word-drag-select";
import {
  buildWordAnnotations,
  EMPTY_WORD_ANNOTATION,
} from "~/editor/lib/word-annotations";
import { useSelection } from "~/editor/selection-store";
import { useEditor, useEditorEqual, useGlobalWords } from "~/editor/store";
import { useTranscriptUi } from "~/editor/transcript-ui-store";
import { cn } from "~/lib/utils";

import type { GlobalTranscriptWord } from "~/domain/transcript";
import type { ReactNode } from "react";

function endsWithSentencePunctuation(text: string): boolean {
  return /[.?!]+$/.test(text.trim());
}

/** Group spoken (non-gap) words into sentences on `.?!`. */
function groupWordsBySentence(
  words: readonly GlobalTranscriptWord[],
): GlobalTranscriptWord[][] {
  if (words.length === 0) return [];
  const sentences: GlobalTranscriptWord[][] = [];
  let batch: GlobalTranscriptWord[] = [];
  for (const word of words) {
    batch.push(word);
    if (endsWithSentencePunctuation(word.text)) {
      sentences.push(batch);
      batch = [];
    }
  }
  if (batch.length > 0) sentences.push(batch);
  return sentences;
}

export function TranscriptPanel() {
  const edits = useEditorEqual((s) => s.config?.edits, editsTopologyEqual);
  const words = useGlobalWords();
  const visibleWords = useMemo(() => words.filter((w) => !w.inGap), [words]);
  const arolls = useEditor((s) => s.config?.arolls);
  const assets = useEditor((s) => s.assets);
  const layout = useMemo(() => {
    return buildArollLayoutFromAssets(arolls ?? [], assets);
  }, [arolls, assets]);
  const projectPanel = useSelection((s) => s.projectPanel);
  const clearSelection = useSelection((s) => s.clearSelection);
  const openCaptionsPanel = useSelection((s) => s.openCaptionsPanel);
  const openSettingsPanel = useSelection((s) => s.openSettingsPanel);
  const { onDragStart } = useWordDragSelect();
  const { beginResize, consumeJustResized } = useRangeResize();
  const transitionDragActive = useTranscriptUi((s) => s.transitionDragActive);

  const annotations = useMemo(
    () => buildWordAnnotations(visibleWords, edits ?? [], layout),
    [visibleWords, edits, layout],
  );

  const transitionDropIndexes = useMemo(() => {
    if (!transitionDragActive) return null;
    return new Set(
      validTransitionDrops(words, layout).map((d) => d.globalIndex),
    );
  }, [transitionDragActive, words, layout]);

  const sentences = useMemo(
    () => groupWordsBySentence(visibleWords),
    [visibleWords],
  );

  const nodes: ReactNode[] = sentences.map((sentence) => {
    const first = sentence[0]!;
    return (
      <div key={first.globalIndex}>
        {sentence.map((word) => {
          const annotation =
            annotations.get(word.globalIndex) ?? EMPTY_WORD_ANNOTATION;
          return (
            <WordCell
              key={word.globalIndex}
              word={word}
              annotation={annotation}
              onWordDragStart={(e) => onDragStart(word.globalIndex, e)}
              onResizeEdge={beginResize}
              transitionDropGlow={
                transitionDropIndexes?.has(word.globalIndex) ?? false
              }
            />
          );
        })}
      </div>
    );
  });

  return (
    <div className="border-border bg-panel flex min-h-0 min-w-0 flex-col overflow-hidden border-r">
      <div className="border-border flex h-12 shrink-0 items-center justify-between gap-3 border-b px-3">
        <ProjectTitleField />
        <div className="flex shrink-0 items-center gap-2">
          <TranscriptChromeVisibilityToggles />
          <button
            type="button"
            className={cn(
              "inline-flex h-7 items-center gap-1.5 rounded-[8px] px-2 text-xs font-medium transition-colors",
              projectPanel === "captions"
                ? "bg-[#FFA102] text-[#450E16]"
                : "text-[#F5F9CE]/60 hover:bg-white/10 hover:text-[#F5F9CE]",
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
              "inline-flex h-7 items-center gap-1.5 rounded-[8px] px-2 text-xs font-medium transition-colors",
              projectPanel === "settings"
                ? "bg-[#FFA102] text-[#450E16]"
                : "text-[#F5F9CE]/60 hover:bg-white/10 hover:text-[#F5F9CE]",
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
          <div className="px-6 py-5 text-[18px] leading-[1.85] text-[#F5F9CE]">
            {visibleWords.length === 0 ? (
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
