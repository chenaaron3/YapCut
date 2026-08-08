import { useEditor } from "~/editor/store";

export function AssetsPanel() {
  const assets = useEditor((s) => s.assets);

  return (
    <aside className="flex h-full min-h-0 flex-col overflow-hidden border-r border-border bg-panel">
      <div className="shrink-0 border-b border-border px-3 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Assets
      </div>
      <div className="min-h-0 flex-1 overflow-auto p-2">
        {assets.length === 0 ? (
          <p className="px-1 text-xs text-muted-foreground">No assets</p>
        ) : (
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
        )}
      </div>
    </aside>
  );
}
