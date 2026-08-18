import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Blend,
  ChevronRight,
  Film,
  Image,
  Music2,
  Sparkles,
  Volume2,
  type LucideIcon,
} from "lucide-react";

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

const TABS: { id: Tab; label: string; Icon: LucideIcon }[] = [
  { id: "aroll", label: "A-roll", Icon: Film },
  { id: "broll", label: "B-roll", Icon: Image },
  { id: "sfx", label: "SFX", Icon: Volume2 },
  { id: "vfx", label: "VFX", Icon: Sparkles },
  { id: "transitions", label: "Transitions", Icon: Blend },
  { id: "music", label: "Music", Icon: Music2 },
];

export function AssetsPanel() {
  const assets = useEditor((s) => s.assets);
  const config = useEditor((s) => s.config);
  const [tab, setTab] = useState<Tab>("vfx");
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateOverflow = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
  }, []);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    updateOverflow();
    const observer = new ResizeObserver(updateOverflow);
    observer.observe(el);
    el.addEventListener("scroll", updateOverflow, { passive: true });
    return () => {
      observer.disconnect();
      el.removeEventListener("scroll", updateOverflow);
    };
  }, [updateOverflow]);

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
    <aside className="border-border bg-panel hidden h-full min-h-0 flex-col overflow-hidden border-r lg:flex">
      <div className="border-border relative flex h-12 shrink-0 items-center border-b">
        <div
          ref={scrollerRef}
          role="tablist"
          aria-label="Asset categories"
          className="scrollbar-none flex min-w-0 w-full gap-1 overflow-x-auto px-1.5 pr-7"
        >
          {TABS.map(({ id, label, Icon }) => {
            const active = tab === id;
            return (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={active}
                className={cn(
                  "flex shrink-0 flex-col items-center gap-1 px-1.5 text-[10px] leading-none whitespace-nowrap transition-colors",
                  active
                    ? "text-[#FFA102]"
                    : "text-[#C8CDD8] hover:text-[#F5F9CE]",
                )}
                onClick={() => setTab(id)}
              >
                <Icon className="size-4 stroke-[1.6]" aria-hidden />
                {label}
              </button>
            );
          })}
        </div>
        {canScrollRight ? (
          <div className="pointer-events-none absolute inset-y-0 right-0 flex w-8 items-center justify-end bg-linear-to-l from-panel from-55% to-transparent pr-1">
            <button
              type="button"
              aria-label="Scroll to more asset categories"
              className="pointer-events-auto flex size-5 items-center justify-center rounded-md bg-[#2A2F3C] text-[#C8CDD8] hover:text-[#F5F9CE]"
              onClick={() => {
                scrollerRef.current?.scrollBy({ left: 72, behavior: "smooth" });
              }}
            >
              <ChevronRight className="size-3.5" aria-hidden />
            </button>
          </div>
        ) : null}
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
