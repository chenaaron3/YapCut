import type { SfxEdit } from "~/domain/project-config";
import { formatSfxLabel } from "~/domain/sfx";
import { MediaRefFields } from "~/editor/components/inspector/field";
import { useEditor } from "~/editor/store";

export function SfxInspector({ edit }: { edit: SfxEdit }) {
  const assets = useEditor((s) => s.assets);
  const asset = assets.find((a) => a.id === edit.assetId);
  const label = formatSfxLabel(asset?.originalFilename, edit.assetId);

  return (
    <div className="flex w-full min-w-0 flex-col gap-4">
      <p className="truncate text-[11px] text-muted-foreground" title={label}>
        {label}
      </p>
      <MediaRefFields media={edit} target={edit.id} />
    </div>
  );
}
