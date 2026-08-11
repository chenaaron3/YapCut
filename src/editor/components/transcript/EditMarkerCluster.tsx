import { useEffect } from "react";

import {
  EditMarker,
  markerLabel,
} from "~/editor/components/transcript/EditMarker";
import { chromeByKey } from "~/editor/lib/edit-chrome";
import { isSelected } from "~/editor/lib/selection";
import {
  resolvePrimarySpan,
  sortByChromePriority,
  type WordEditSpan,
} from "~/editor/lib/word-annotations";
import { useSelection } from "~/editor/selection-store";
import { useTranscriptUi } from "~/editor/transcript-ui-store";
import { cn } from "~/lib/utils";

type Props = {
  /** Word globalIndex — identity for single-open expand state. */
  wordIndex: number;
  markers: WordEditSpan[];
  isEditSelected: (editId: number) => boolean;
  onSelect: (editId: number, toggle: boolean) => void;
  onDragStart?: (editId: number, e: React.MouseEvent) => void;
};

function MarkerDot({
  span,
  selected,
  onSelect,
}: {
  span: WordEditSpan;
  selected: boolean;
  onSelect: (editId: number, toggle: boolean) => void;
}) {
  const chrome = chromeByKey(span.chromeKey);
  const label = markerLabel(span);

  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      className={cn(
        "size-[0.35em] shrink-0 rounded-full",
        chrome.dotClass,
        selected && "ring-1 ring-white/80 ring-offset-1 ring-offset-background",
      )}
      onMouseDown={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(span.editId, e.metaKey || e.ctrlKey);
      }}
    />
  );
}

/**
 * Collapses multiple start markers on one word: primary chip + priority dots.
 * Click expands inline to all chips; primary click toggles shut. One cluster open at a time.
 */
export function EditMarkerCluster({
  wordIndex,
  markers,
  isEditSelected,
  onSelect,
  onDragStart,
}: Props) {
  const selection = useSelection((s) => s.selection);
  const expandedWordIndex = useTranscriptUi((s) => s.expandedWordIndex);
  const expandCluster = useTranscriptUi((s) => s.expandCluster);
  const collapseCluster = useTranscriptUi((s) => s.collapseCluster);
  const toggleCluster = useTranscriptUi((s) => s.toggleCluster);

  const expanded = expandedWordIndex === wordIndex;

  const editIds = markers.map((m) => m.editId);
  const clusterHasSelection = editIds.some((id) =>
    isSelected(selection, "edit", id),
  );

  // Collapse when selection leaves every edit in this cluster (incl. clear).
  useEffect(() => {
    if (!expanded) return;
    if (!clusterHasSelection) collapseCluster();
  }, [expanded, clusterHasSelection, collapseCluster]);

  if (markers.length === 0) return null;

  const primary = resolvePrimarySpan(markers, selection);
  if (!primary) return null;

  const ordered = sortByChromePriority(markers);
  const secondaries = ordered.filter((s) => s.editId !== primary.editId);
  const canExpand = secondaries.length > 0;

  if (!canExpand) {
    return (
      <span className="mr-0.5 inline-flex align-middle">
        <EditMarker
          span={primary}
          selected={isEditSelected(primary.editId)}
          onSelect={onSelect}
          onDragStart={onDragStart}
        />
      </span>
    );
  }

  if (expanded) {
    return (
      <span className="mr-0.5 inline-flex items-center gap-0.5 align-middle">
        {ordered.map((span) => {
          const isPrimary = span.editId === primary.editId;
          return (
            <EditMarker
              key={`${span.chromeKey}-${span.editId}`}
              span={span}
              selected={isEditSelected(span.editId)}
              onSelect={(editId, toggleSelect) => {
                onSelect(editId, toggleSelect);
                if (isPrimary) toggleCluster(wordIndex);
              }}
              onDragStart={onDragStart}
            />
          );
        })}
      </span>
    );
  }

  return (
    <span className="mr-0.5 inline-flex items-center gap-0.5 align-middle">
      <EditMarker
        span={primary}
        selected={isEditSelected(primary.editId)}
        onSelect={(editId, toggleSelect) => {
          onSelect(editId, toggleSelect);
          expandCluster(wordIndex);
        }}
        onDragStart={onDragStart}
      />
      <span className="inline-flex flex-col justify-center gap-px py-px">
        {secondaries.map((span) => (
          <MarkerDot
            key={`${span.chromeKey}-${span.editId}`}
            span={span}
            selected={isEditSelected(span.editId)}
            onSelect={(editId, toggleSelect) => {
              onSelect(editId, toggleSelect);
              expandCluster(wordIndex);
            }}
          />
        ))}
      </span>
    </span>
  );
}
