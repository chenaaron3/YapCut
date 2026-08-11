import { Film, Sparkles, Volume2, ZoomIn, type LucideIcon } from "lucide-react";

import type { TranscriptChromeGroup } from "~/editor/lib/transcript-chrome-visibility";
import { useTranscriptUi } from "~/editor/transcript-ui-store";
import { cn } from "~/lib/utils";

const TOGGLES: readonly {
  group: TranscriptChromeGroup;
  label: string;
  Icon: LucideIcon;
  onClass: string;
}[] = [
  {
    group: "broll",
    label: "B-roll",
    Icon: Film,
    onClass: "bg-broll/25 text-broll",
  },
  {
    group: "vfx",
    label: "VFX",
    Icon: Sparkles,
    onClass: "bg-vfx/25 text-vfx",
  },
  {
    group: "sfx",
    label: "SFX",
    Icon: Volume2,
    onClass: "bg-sfx/25 text-sfx",
  },
  {
    group: "zoom",
    label: "Zoom",
    Icon: ZoomIn,
    onClass: "bg-zoom/25 text-zoom",
  },
];

/** Multi-toggle: which edit kinds show chrome in the transcript (session-only). */
export function TranscriptChromeVisibilityToggles() {
  const visible = useTranscriptUi((s) => s.visible);
  const toggleVisible = useTranscriptUi((s) => s.toggleVisible);

  return (
    <div
      className="flex items-center gap-0.5"
      role="group"
      aria-label="Transcript chrome visibility"
    >
      {TOGGLES.map(({ group, label, Icon, onClass }) => {
        const on = visible[group];
        return (
          <button
            key={group}
            type="button"
            title={on ? `Hide ${label} in transcript` : `Show ${label} in transcript`}
            aria-label={on ? `Hide ${label} in transcript` : `Show ${label} in transcript`}
            aria-pressed={on}
            className={cn(
              "rounded p-1 transition-colors",
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
          </button>
        );
      })}
    </div>
  );
}
