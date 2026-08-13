import { useEffect, type ReactNode } from "react";

import {
  EditMarker,
  markerLabel,
} from "~/editor/components/transcript/EditMarker";
import { chromeByKey } from "~/editor/lib/edit-chrome";
import { useEntitySelected } from "~/editor/lib/use-is-selected";
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

function MarkerSelected({
  editId,
  children,
}: {
  editId: number;
  children: (selected: boolean) => ReactNode;
}) {
  const selected = useEntitySelected("edit", editId);
  return <>{children(selected)}</>;
}

/**
 * Collapses multiple start markers on one word: primary chip + priority dots.
 * Click expands inline to all chips; primary click toggles shut. One cluster open at a time.
 */
export function EditMarkerCluster({
  wordIndex,
  markers,
  onSelect,
  onDragStart,
}: Props) {
  const expandedWordIndex = useTranscriptUi((s) => s.expandedWordIndex);
  const expandCluster = useTranscriptUi((s) => s.expandCluster);
  const collapseCluster = useTranscriptUi((s) => s.collapseCluster);
  const toggleCluster = useTranscriptUi((s) => s.toggleCluster);

  const expanded = expandedWordIndex === wordIndex;

  // Stable across word-playback selection changes (edit selection only).
  const primaryEditId = useSelection((s) => {
    return resolvePrimarySpan(markers, s.selection)?.editId ?? null;
  });
  const selectedEditKey = useSelection((s) => {
    const selection = s.selection;
    if (selection?.kind !== "edit") return "";
    return markers
      .filter((m) => selection.ids.includes(m.editId))
      .map((m) => m.editId)
      .sort((a, b) => a - b)
      .join(",");
  });

  const primary =
    primaryEditId != null
      ? (markers.find((m) => m.editId === primaryEditId) ?? null)
      : null;
  const clusterHasSelection = selectedEditKey.length > 0;

  // Collapse when selection leaves every edit in this cluster (incl. clear).
  useEffect(() => {
    if (!expanded) return;
    if (!clusterHasSelection) collapseCluster();
  }, [expanded, clusterHasSelection, collapseCluster]);

  if (markers.length === 0) return null;
  if (!primary) return null;

  const ordered = sortByChromePriority(markers);
  const secondaries = ordered.filter((s) => s.editId !== primary.editId);
  const canExpand = secondaries.length > 0;

  if (!canExpand) {
    return (
      <span className="inline-flex align-middle">
        <MarkerSelected editId={primary.editId}>
          {(selected) => (
            <EditMarker
              span={primary}
              selected={selected}
              onSelect={onSelect}
              onDragStart={onDragStart}
            />
          )}
        </MarkerSelected>
      </span>
    );
  }

  if (expanded) {
    return (
      <span className="inline-flex items-center gap-0.5 align-middle">
        {ordered.map((span) => {
          const isPrimary = span.editId === primary.editId;
          return (
            <MarkerSelected key={`${span.chromeKey}-${span.editId}`} editId={span.editId}>
              {(selected) => (
                <EditMarker
                  span={span}
                  selected={selected}
                  className={cn(
                    "hover:ring-1 hover:ring-white/80 hover:ring-offset-1 hover:ring-offset-background",
                    selected &&
                      "ring-1 ring-white/80 ring-offset-1 ring-offset-background",
                  )}
                  onSelect={(editId, toggleSelect) => {
                    onSelect(editId, toggleSelect);
                    if (isPrimary) toggleCluster(wordIndex);
                  }}
                  onDragStart={onDragStart}
                />
              )}
            </MarkerSelected>
          );
        })}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-0.5 align-middle">
      <MarkerSelected editId={primary.editId}>
        {(selected) => (
          <EditMarker
            span={primary}
            selected={selected}
            onSelect={(editId, toggleSelect) => {
              onSelect(editId, toggleSelect);
              expandCluster(wordIndex);
            }}
            onDragStart={onDragStart}
          />
        )}
      </MarkerSelected>
      <span className="inline-flex flex-col justify-center gap-px py-px">
        {secondaries.map((span) => (
          <MarkerSelected
            key={`${span.chromeKey}-${span.editId}`}
            editId={span.editId}
          >
            {(selected) => (
              <MarkerDot
                span={span}
                selected={selected}
                onSelect={(editId, toggleSelect) => {
                  onSelect(editId, toggleSelect);
                  expandCluster(wordIndex);
                }}
              />
            )}
          </MarkerSelected>
        ))}
      </span>
    </span>
  );
}
