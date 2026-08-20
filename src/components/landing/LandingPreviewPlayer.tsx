"use client";

import { Player } from "@remotion/player";
import { Pause, Play } from "lucide-react";
import { useMemo, useRef, useState } from "react";

import { emberCard } from "~/components/landing/landing-ui";
import { LandingSparkles } from "~/components/landing/LandingSparkles";
import { Card, CardContent } from "~/components/ui/card";
import { hydrateInputFromProject } from "~/editor/lib/project/hydrate-project";
import { projectPropsFromAssets } from "~/editor/lib/project/project-props";
import { cn } from "~/lib/utils";
import {
  COMPOSITION_FPS,
  COMPOSITION_HEIGHT,
  COMPOSITION_WIDTH,
} from "~/remotion/helpers/constants";
import { TalkingHead } from "~/remotion/TalkingHead";
import { api } from "~/utils/api";

import type { PlayerRef } from "@remotion/player";

export function LandingPreviewPlayer({ projectId }: { projectId: string }) {
  const projectQuery = api.project.byId.useQuery(
    { id: projectId },
    { enabled: projectId.length > 0 },
  );
  const globalAssetsQuery = api.project.listGlobalAssets.useQuery(undefined, {
    staleTime: 60_000,
  });

  const inputProps = useMemo(() => {
    const data = projectQuery.data;
    if (!data || data.status !== "ready") return null;
    const hydrated = hydrateInputFromProject(
      data,
      globalAssetsQuery.data ?? [],
    );
    const transcriptsByAssetId: Record<
      string,
      (typeof hydrated.transcripts)[number]["words"]
    > = {};
    for (const row of hydrated.transcripts) {
      transcriptsByAssetId[row.assetId] = row.words;
    }
    return projectPropsFromAssets({
      config: hydrated.config,
      title: hydrated.title,
      assets: hydrated.assets,
      transcriptsByAssetId,
    });
  }, [globalAssetsQuery.data, projectQuery.data]);

  const playerRef = useRef<PlayerRef>(null);
  const [playing, setPlaying] = useState(false);

  const toggle = () => {
    const player = playerRef.current;
    if (!player) return;
    if (player.isPlaying()) {
      player.pause();
      setPlaying(false);
      return;
    }
    void player.play();
    setPlaying(true);
  };

  const ready = Boolean(inputProps && inputProps.sections.length > 0);
  const durationInFrames = Math.max(1, inputProps?.durationInFrames ?? 1);

  return (
    <div className="relative w-[62%] sm:w-[200px] lg:w-[220px]">
      <LandingSparkles active={ready} />
      <Card
        className={cn(
          emberCard,
          "w-full gap-0 bg-[#F5F9CE] p-1 text-[#450E16] sm:p-1.5",
        )}
      >
        <CardContent className="p-0">
          <button
            type="button"
            aria-label={playing ? "Pause preview" : "Play preview"}
            disabled={!ready}
            className="relative block aspect-[9/16] w-full overflow-hidden rounded-[12px] border-2 border-[#450E16] bg-[#450E16] sm:rounded-[16px]"
            onClick={toggle}
          >
            {inputProps && inputProps.sections.length > 0 ? (
              <Player
                ref={playerRef}
                component={TalkingHead}
                inputProps={inputProps}
                durationInFrames={durationInFrames}
                compositionWidth={COMPOSITION_WIDTH}
                compositionHeight={COMPOSITION_HEIGHT}
                fps={COMPOSITION_FPS}
                style={{ width: "100%", height: "100%" }}
                controls={false}
                clickToPlay={false}
                spaceKeyToPlayOrPause={false}
              />
            ) : (
              <span className="ember-mono absolute inset-0 grid place-items-center text-[8px] tracking-[.12em] text-[#F5F9CE]/55 uppercase">
                Loading…
              </span>
            )}
            <span className="ember-mono absolute top-1.5 left-1.5 rounded-full bg-[#FFA102] px-1.5 py-0.5 text-[7px] font-bold tracking-[0.1em] text-[#450E16] uppercase sm:top-2 sm:left-2 sm:px-2 sm:py-1 sm:text-[8px]">
              After
            </span>
            {ready ? (
              <span className="absolute right-1.5 bottom-1.5 grid size-6 place-items-center rounded-full border-2 border-[#450E16] bg-[#FFA102] text-[#450E16] sm:right-2.5 sm:bottom-2.5 sm:size-8">
                {playing ? (
                  <Pause className="size-3 sm:size-3.5" />
                ) : (
                  <Play className="size-3 translate-x-px sm:size-3.5" />
                )}
              </span>
            ) : null}
          </button>
        </CardContent>
      </Card>
    </div>
  );
}
