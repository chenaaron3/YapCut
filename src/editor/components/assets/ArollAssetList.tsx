import type { EditorAsset } from "~/editor/store";

export function ArollAssetList({ assets }: { assets: EditorAsset[] }) {
  if (assets.length === 0) {
    return (
      <div className="p-2">
        <p className="px-1 text-xs text-muted-foreground">No A-roll</p>
      </div>
    );
  }

  return (
    <div className="p-2">
      <ul className="flex flex-col gap-1">
        {assets.map((asset) => (
          <li
            key={asset.id}
            className="rounded-md bg-panel-2 px-2 py-2 text-sm"
          >
            <div className="truncate font-medium">
              {asset.originalFilename ?? asset.id.slice(0, 8)}
            </div>
            <div className="mt-0.5 text-xs text-muted-foreground">
              {asset.kind}
              {asset.durationSec != null
                ? ` · ${asset.durationSec.toFixed(1)}s`
                : null}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
