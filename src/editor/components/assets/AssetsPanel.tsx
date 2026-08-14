import { useMemo, useState } from "react";

import { arollAssetOrder } from "~/domain/arolls";
import { ArollAssetList } from "~/editor/components/assets/ArollAssetList";
import { BrollLibrary } from "~/editor/components/assets/BrollLibrary";
import { MusicLibrary } from "~/editor/components/assets/MusicLibrary";
import { SfxLibrary } from "~/editor/components/assets/SfxLibrary";
import { TransitionsLibrary } from "~/editor/components/assets/TransitionsLibrary";
import { VfxLibrary } from "~/editor/components/assets/VfxLibrary";
import { useEditor } from "~/editor/store";
import { cn } from "~/lib/utils";

type Tab = "aroll" | "broll" | "vfx" | "sfx" | "music" | "transitions";

export function AssetsPanel() {
  const assets = useEditor((s) => s.assets);
  const config = useEditor((s) => s.config);
  const [tab, setTab] = useState<Tab>("vfx");

  const arollOrder = useMemo(
    () => arollAssetOrder(config?.arolls ?? []),
    [config?.arolls],
  );

  const arollIds = useMemo(() => new Set(arollOrder), [arollOrder]);

  const arollAssets = useMemo(() => {
    const byId = new Map(assets.map((a) => [a.id, a]));
    return arollOrder
      .map((id) => byId.get(id))
      .filter((a): a is NonNullable<typeof a> => a != null);
  }, [assets, arollOrder]);

  const brollAssets = useMemo(
    () =>
      assets.filter(
        (a) =>
          (a.kind === "image" || a.kind === "video") && !arollIds.has(a.id),
      ),
    [assets, arollIds],
  );

  const sfxAssets = useMemo(
    () => assets.filter((a) => a.audioLibrary === "sfx"),
    [assets],
  );

  const musicAssets = useMemo(
    () => assets.filter((a) => a.audioLibrary === "music"),
    [assets],
  );

  return (
    <aside className="flex h-full min-h-0 flex-col overflow-hidden border-r border-border bg-panel">
      <div className="flex shrink-0 flex-nowrap gap-1 overflow-x-auto border-b border-border px-2 py-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {(
          [
            ["aroll", "A-roll"],
            ["broll", "B-roll"],
            ["vfx", "VFX"],
            ["transitions", "Transitions"],
            ["sfx", "SFX"],
            ["music", "Music"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={cn(
              "shrink-0 whitespace-nowrap rounded px-2 py-1 text-[11px] font-medium",
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
        ) : tab === "transitions" ? (
          <TransitionsLibrary />
        ) : tab === "music" ? (
          <MusicLibrary assets={musicAssets} />
        ) : (
          <SfxLibrary assets={sfxAssets} />
        )}
      </div>
    </aside>
  );
}
