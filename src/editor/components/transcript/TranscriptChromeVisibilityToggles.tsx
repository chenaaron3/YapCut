import { Eye, EyeOff, type LucideIcon } from "lucide-react";

import type { Edit } from "~/domain/project-config";
import {
  chromeByKey,
  chromeForEdit,
  EDIT_CHROME,
} from "~/editor/lib/edit-chrome";
import type { TranscriptChromeGroup } from "~/editor/lib/transcript-chrome-visibility";
import { useEditor } from "~/editor/store";
import { useTranscriptUi } from "~/editor/transcript-ui-store";
import { cn } from "~/lib/utils";

const TOGGLE_STYLE: Record<
  TranscriptChromeGroup,
  { onClass: string; badgeClass: string }
> = {
  broll: {
    onClass: "bg-broll/25 text-broll",
    badgeClass: "bg-broll text-black",
  },
  "vfx:text": {
    onClass: "bg-vfx/25 text-vfx",
    badgeClass: "bg-vfx text-black",
  },
  "vfx:quote": {
    onClass: "bg-vfx/25 text-vfx",
    badgeClass: "bg-vfx text-black",
  },
  "vfx:listicle": {
    onClass: "bg-vfx/25 text-vfx",
    badgeClass: "bg-vfx text-black",
  },
  "vfx:shake": {
    onClass: "bg-vfx/25 text-vfx",
    badgeClass: "bg-vfx text-black",
  },
  sfx: {
    onClass: "bg-sfx/25 text-sfx",
    badgeClass: "bg-sfx text-black",
  },
  zoom: {
    onClass: "bg-zoom/25 text-zoom",
    badgeClass: "bg-zoom text-white",
  },
};

const TOGGLES: readonly {
  group: TranscriptChromeGroup;
  Icon: LucideIcon;
  onClass: string;
  badgeClass: string;
}[] = EDIT_CHROME.map((spec) => {
  const style = TOGGLE_STYLE[spec.key];
  return {
    group: spec.key,
    Icon: spec.Icon,
    onClass: style.onClass,
    badgeClass: style.badgeClass,
  };
});

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

/** Multi-toggle: which edit kinds show chrome in the transcript (session-only). */
export function TranscriptChromeVisibilityToggles() {
  const visible = useTranscriptUi((s) => s.visible);
  const toggleVisible = useTranscriptUi((s) => s.toggleVisible);
  const setGroupsVisible = useTranscriptUi((s) => s.setGroupsVisible);
  const edits = useEditor((s) => s.config?.edits ?? []);
  const counts = countEditsByGroup(edits);

  const shown = TOGGLES.filter((t) => (counts[t.group] ?? 0) > 0);
  if (shown.length === 0) return null;

  const onCount = shown.filter((t) => visible[t.group]).length;
  const majorityOn = onCount > shown.length / 2;
  const MasterIcon = majorityOn ? Eye : EyeOff;
  const masterLabel = majorityOn
    ? "Hide all edits in transcript"
    : "Show all edits in transcript";

  return (
    <div
      className="flex items-center gap-0.5"
      role="group"
      aria-label="Edit visibility toggles"
    >
      {shown.map(({ group, Icon, onClass, badgeClass }) => {
        const on = visible[group];
        const count = counts[group] ?? 0;
        const titleLabel = chromeByKey(group).label;
        return (
          <button
            key={group}
            type="button"
            title={
              on
                ? `Hide ${titleLabel} in transcript`
                : `Show ${titleLabel} in transcript`
            }
            aria-label={
              on
                ? `Hide ${titleLabel} in transcript (${count})`
                : `Show ${titleLabel} in transcript (${count})`
            }
            aria-pressed={on}
            className={cn(
              "relative rounded p-1 transition-colors",
              on
                ? onClass
                : "text-muted-foreground/40 hover:bg-panel-2 hover:text-muted-foreground",
            )}
            onClick={(e) => {
              e.stopPropagation();
              toggleVisible(group);
            }}
          >
            <Icon className="size-3.5" strokeWidth={2.25} />
            <span
              className={cn(
                "pointer-events-none absolute -right-0.5 -top-0.5 flex h-2.5 min-w-2.5 items-center justify-center rounded-full px-0.5 text-[8px] font-semibold leading-none",
                on ? badgeClass : "bg-muted-foreground/50 text-background",
              )}
            >
              {count > 99 ? "99+" : count}
            </span>
          </button>
        );
      })}
      <button
        type="button"
        title={masterLabel}
        aria-label={masterLabel}
        aria-pressed={majorityOn}
        className={cn(
          "ml-0.5 rounded p-1 transition-colors",
          majorityOn
            ? "bg-foreground/10 text-foreground"
            : "text-muted-foreground/40 hover:bg-panel-2 hover:text-muted-foreground",
        )}
        onClick={(e) => {
          e.stopPropagation();
          setGroupsVisible(
            shown.map((t) => t.group),
            !majorityOn,
          );
        }}
      >
        <MasterIcon className="size-3.5" strokeWidth={2.25} />
      </button>
    </div>
  );
}
