import { Label } from "~/components/ui/label";
import { transformOf } from "~/domain/transform";
import { resolveZoomEase } from "~/domain/zoom";
import { TransformFields } from "~/editor/components/inspector/field";
import { useEditor } from "~/editor/store";
import { cn } from "~/lib/utils";

import type { ZoomEdit } from "~/domain/project-config";

export function ZoomInspector({ edit }: { edit: ZoomEdit }) {
  const patchEdit = useEditor((s) => s.patchEdit);
  const ease = resolveZoomEase(edit.ease);
  const transform = transformOf(edit);

  return (
    <div className="flex w-full min-w-0 flex-col gap-4">
      <button
        type="button"
        className="flex items-center justify-between gap-2 text-left"
        onClick={() => patchEdit(edit.id, { ease: !ease }, false)}
      >
        <Label className="text-muted-foreground text-[10px] tracking-wider uppercase">
          Ease
        </Label>
        <span
          className={cn(
            "rounded px-1.5 py-0.5 text-[10px] font-medium",
            ease
              ? "bg-primary/20 text-primary"
              : "bg-panel-2 text-muted-foreground",
          )}
        >
          {ease ? "On" : "Off"}
        </span>
      </button>

      <TransformFields
        transform={transform}
        defaultOpen
        onPatch={(partial, live) => patchEdit(edit.id, partial, live)}
      />
    </div>
  );
}
