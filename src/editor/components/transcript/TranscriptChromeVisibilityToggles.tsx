import { ChevronDown, Eye, EyeOff, Layers } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import {
  chromeByKey,
  chromeForEdit,
  EDIT_CHROME,
} from "~/editor/lib/edit-chrome";
import { editsTopologyEqual } from "~/editor/lib/edit-topology";
import { useEditorEqual } from "~/editor/store";
import { useTranscriptUi } from "~/editor/transcript-ui-store";
import { cn } from "~/lib/utils";

import type { Edit } from "~/domain/project-config";
import type { TranscriptChromeGroup } from "~/editor/lib/transcript-chrome-visibility";

const VISIBILITY_LABEL: Record<TranscriptChromeGroup, string> = {
  broll: "B-roll",
  "vfx:text": "Text",
  "vfx:quote": "Quote",
  "vfx:listicle": "Listicle",
  "vfx:shake": "Shake",
  sfx: "SFX",
  zoom: "Zoom",
  transition: "Transition",
};

function countEditsByGroup(
  edits: readonly Edit[],
): Partial<Record<TranscriptChromeGroup, number>> {
  const counts: Partial<Record<TranscriptChromeGroup, number>> = {};
  for (const edit of edits) {
    const key = chromeForEdit(edit)?.key;
    if (!key) continue;
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

/** Compact trigger + menu: which edit kinds show chrome in the transcript. */
export function TranscriptChromeVisibilityToggles() {
  const visible = useTranscriptUi((s) => s.visible);
  const toggleVisible = useTranscriptUi((s) => s.toggleVisible);
  const setGroupsVisible = useTranscriptUi((s) => s.setGroupsVisible);
  const edits = useEditorEqual((s) => s.config?.edits, editsTopologyEqual);
  const counts = countEditsByGroup(edits ?? []);

  const shown = EDIT_CHROME.filter((spec) => (counts[spec.key] ?? 0) > 0);
  if (shown.length === 0) return null;

  const onCount = shown.filter((spec) => visible[spec.key]).length;
  const majorityOn = onCount > shown.length / 2;
  const MasterIcon = majorityOn ? Eye : EyeOff;
  const masterLabel = majorityOn
    ? "Hide all edits in transcript"
    : "Show all edits in transcript";
  const totalEdits = shown.reduce(
    (sum, spec) => sum + (counts[spec.key] ?? 0),
    0,
  );
  const typeLabel = totalEdits === 1 ? "1 edit" : `${totalEdits} edits`;

  return (
    <DropdownMenu modal={false} highlightItemOnHover={false}>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            className="border-border bg-panel-2 hover:border-muted-foreground/40 inline-flex h-7 items-center gap-2 rounded-md border px-2.5 text-xs font-medium"
            aria-label={`Toggle visibility, ${typeLabel}`}
            title="Show or hide edit markers in the transcript"
          />
        }
      >
        <Layers className="text-muted-foreground size-3.5" />
        {typeLabel}
        <ChevronDown className="text-muted-foreground size-3.5 in-data-popup-open:rotate-180" />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        sideOffset={6}
        className="w-max min-w-0 p-1"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 px-2 py-1">
          <p className="flex-1 text-xs font-semibold whitespace-nowrap">
            Toggle visibility
          </p>
          <button
            type="button"
            title={masterLabel}
            aria-label={masterLabel}
            aria-pressed={majorityOn}
            className="text-muted-foreground hover:bg-panel-2 hover:text-foreground flex size-6 items-center justify-center rounded-md"
            onClick={(e) => {
              e.stopPropagation();
              setGroupsVisible(
                shown.map((spec) => spec.key),
                !majorityOn,
              );
            }}
          >
            <MasterIcon className="size-3.5" />
          </button>
        </div>
        <DropdownMenuSeparator className="mx-0" />
        {shown.map((spec) => {
          const on = visible[spec.key];
          const count = counts[spec.key] ?? 0;
          const label =
            VISIBILITY_LABEL[spec.key] ?? chromeByKey(spec.key).label;
          const RowIcon = on ? Eye : EyeOff;
          return (
            <DropdownMenuItem
              key={spec.key}
              closeOnClick={false}
              aria-pressed={on}
              label={label}
              className={cn(
                "h-8 gap-2 px-2 text-xs hover:bg-panel-2",
                "focus:bg-panel-2 focus:text-foreground data-highlighted:bg-panel-2 data-highlighted:text-foreground",
                !on && "text-muted-foreground/50",
              )}
              onClick={(e) => {
                e.stopPropagation();
                toggleVisible(spec.key);
              }}
            >
              <span
                className={cn("size-2 shrink-0 rounded-full", spec.dotClass)}
              />
              <span className="pr-4 whitespace-nowrap">{label}</span>
              <span className="text-muted-foreground ml-auto text-[11px] tabular-nums">
                {count}
              </span>
              <RowIcon className="text-muted-foreground size-3.5" />
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
