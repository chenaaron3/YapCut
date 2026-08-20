import { formatSfxLabel } from "~/domain/edit/sfx";
import { MediaRefFields } from "~/editor/components/inspector/field";
import { useEditor } from "~/editor/store";

import type { SfxEdit } from "~/domain/project/project-config";

export function SfxInspector({ edit }: { edit: SfxEdit }) {
  const assets = useEditor((s) => s.assets);
  const asset = assets.find((a) => a.id === edit.assetId);
  const label = formatSfxLabel(asset?.originalFilename, edit.assetId);

  return (
    <div className="flex w-full min-w-0 flex-col gap-4">
      <p className="text-muted-foreground truncate text-[11px]" title={label}>
        {label}
      </p>
      <MediaRefFields media={edit} target={edit.id} />
    </div>
  );
}
