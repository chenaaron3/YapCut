import { useMemo } from "react";

import { Label } from "~/components/ui/label";
import { buildArollLayoutFromAssets } from "~/domain/arolls";
import {
  maxTransitionDuration,
  resizeTransitionFromDuration,
  TRANSITION_MIN_DURATION_SEC,
  TRANSITION_PRESETS,
  transitionOutputDuration,
} from "~/domain/transition";
import { SliderField } from "~/editor/components/inspector/field";
import { useEditor } from "~/editor/store";
import { cn } from "~/lib/utils";

import type {
  TransitionEdit,
  TransitionTemplateId,
} from "~/domain/project-config";

export function TransitionInspector({ edit }: { edit: TransitionEdit }) {
  const patchEdit = useEditor((s) => s.patchEdit);
  const arolls = useEditor((s) => s.config?.arolls);
  const assets = useEditor((s) => s.assets);
  const layout = useMemo(() => {
    return buildArollLayoutFromAssets(arolls ?? [], assets);
  }, [arolls, assets]);

  const stitch = edit.stitch;
  const duration = transitionOutputDuration(edit);
  const max = maxTransitionDuration(stitch, layout);

  return (
    <div className="flex w-full min-w-0 flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label className="text-muted-foreground text-[10px] tracking-wider uppercase">
          Template
        </Label>
        <div className="grid grid-cols-3 gap-1">
          {TRANSITION_PRESETS.map((preset) => (
            <button
              key={preset.templateId}
              type="button"
              className={cn(
                "rounded px-1.5 py-1 text-[10px] font-medium",
                edit.templateId === preset.templateId
                  ? "bg-primary/20 text-primary"
                  : "bg-panel-2 text-muted-foreground hover:text-foreground",
              )}
              onClick={() =>
                patchEdit(
                  edit.id,
                  { templateId: preset.templateId as TransitionTemplateId },
                  false,
                )
              }
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      <SliderField
        label="Duration"
        value={duration}
        min={TRANSITION_MIN_DURATION_SEC}
        max={Math.max(TRANSITION_MIN_DURATION_SEC, max)}
        step={0.01}
        display={`${duration.toFixed(2)}s`}
        onLiveChange={(value) => {
          const next = resizeTransitionFromDuration(edit, value, layout);
          if (next) {
            patchEdit(
              edit.id,
              {
                durationSec: next.durationSec,
                start: next.start,
                end: next.end,
              },
              true,
            );
          }
        }}
        onCommit={(value) => {
          const next = resizeTransitionFromDuration(edit, value, layout);
          if (next) {
            patchEdit(
              edit.id,
              {
                durationSec: next.durationSec,
                start: next.start,
                end: next.end,
              },
              false,
            );
          }
        }}
      />
    </div>
  );
}
