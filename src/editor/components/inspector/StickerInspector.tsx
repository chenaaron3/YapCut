import { stickerLabel } from "~/domain/sticker";
import { transformOf } from "~/domain/transform";
import { TransformFields } from "~/editor/components/inspector/field";
import { useEditor } from "~/editor/store";

import type { StickerEdit } from "~/domain/project-config";

export function StickerInspector({ edit }: { edit: StickerEdit }) {
  const patchEdit = useEditor((s) => s.patchEdit);
  const transform = transformOf(edit);
  const label = stickerLabel(edit);

  return (
    <div className="flex w-full min-w-0 flex-col gap-4">
      <p className="text-muted-foreground truncate text-[11px]" title={label}>
        {label}
      </p>
      <TransformFields
        transform={transform}
        onPatch={(partial, live) => patchEdit(edit.id, partial, live)}
      />
    </div>
  );
}
