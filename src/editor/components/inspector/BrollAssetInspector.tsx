import { RemoveBackgroundFields } from "~/editor/components/inspector/field/RemoveBackgroundFields";

import type { EditorAsset } from "~/editor/store";

export function BrollAssetInspector({ asset }: { asset: EditorAsset }) {
  return (
    <div className="flex w-full min-w-0 flex-col gap-4">
      <p
        className="text-muted-foreground truncate text-[11px]"
        title={asset.originalFilename ?? asset.id}
      >
        {asset.originalFilename ?? asset.id.slice(0, 8)}
      </p>
      <RemoveBackgroundFields asset={asset} />
    </div>
  );
}
