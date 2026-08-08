import { useMemo, useState } from "react";

import { ArollAssetList } from "~/editor/components/assets/ArollAssetList";
import { BrollLibrary } from "~/editor/components/assets/BrollLibrary";
import { SfxLibrary } from "~/editor/components/assets/SfxLibrary";
import { VfxLibrary } from "~/editor/components/assets/VfxLibrary";
import { useEditor } from "~/editor/store";
import { cn } from "~/lib/utils";

type Tab = "aroll" | "broll" | "vfx" | "sfx";

function arollAssetIds(configArolls: { assetId: string }[]): Set<string> {
  return new Set(configArolls.map((k) => k.assetId));
}

export function AssetsPanel() {
  const assets = useEditor((s) => s.assets);
  const config = useEditor((s) => s.config);
  const [tab, setTab] = useState<Tab>("broll");

  const arollIds = useMemo(
    () => arollAssetIds(config?.arolls ?? []),
    [config?.arolls],
  );

  const arollAssets = useMemo(
    () => assets.filter((a) => arollIds.has(a.id)),
    [assets, arollIds],
  );

  const brollAssets = useMemo(
    () =>
      assets.filter(
        (a) =>
          (a.kind === "image" || a.kind === "video") && !arollIds.has(a.id),
      ),
    [assets, arollIds],
  );

  const sfxAssets = useMemo(
    () => assets.filter((a) => a.kind === "audio"),
    [assets],
  );

  return (
    <aside className="flex h-full min-h-0 flex-col overflow-hidden border-r border-border bg-panel">
      <div className="flex shrink-0 gap-1 border-b border-border px-2 py-1.5">
        {(
          [
            ["aroll", "A-roll"],
            ["broll", "B-roll"],
            ["vfx", "VFX"],
            ["sfx", "SFX"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={cn(
              "rounded px-2 py-1 text-[11px] font-medium",
              tab === id
                ? "bg-panel-2 text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        {tab === "aroll" ? (
          <ArollAssetList assets={arollAssets} />
        ) : tab === "broll" ? (
          <BrollLibrary assets={brollAssets} />
        ) : tab === "vfx" ? (
          <VfxLibrary />
        ) : (
          <SfxLibrary assets={sfxAssets} />
        )}
      </div>
    </aside>
  );
}
