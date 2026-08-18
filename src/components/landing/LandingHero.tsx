"use client";

import { useEffect, useRef } from "react";

import { emberEyebrow } from "~/components/landing/landing-ui";
import { LandingDropZone } from "~/components/landing/LandingDropZone";
import { LandingTrialStage } from "~/components/landing/LandingTrialStage";
import { useCreateProgressStream } from "~/components/projects/use-create-progress-stream";
import { Badge } from "~/components/ui/badge";

import type { useLandingTrial } from "~/components/landing/use-landing-trial";

type Trial = ReturnType<typeof useLandingTrial>;

export function LandingHero({ trial }: { trial: Trial }) {
  const sectionRef = useRef<HTMLElement>(null);
  const showDrop = trial.phase === "idle" || trial.phase === "failed";
  const progress = useCreateProgressStream({
    projectId: trial.projectId ?? "",
    enabled:
      Boolean(trial.projectId) &&
      (trial.phase === "processing" || trial.phase === "restoring"),
    fallback: trial.project?.createProgress ?? null,
    onTerminal: trial.onTerminal,
  });

  useEffect(() => {
    if (trial.phase !== "uploading") return;
    sectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [trial.phase]);

  return (
    <section
      ref={sectionRef}
      id="product"
      aria-labelledby="hero-title"
      className="relative min-h-[100dvh] overflow-x-clip bg-[#450E16] text-[#F5F9CE] lg:h-screen lg:min-h-0"
    >
      <div
        aria-hidden
        className="ember-diagonal absolute -top-40 left-[42%] h-[640px] w-16 rotate-[-42deg] opacity-20"
      />
      <div className="relative mx-auto grid max-w-[1280px] items-center gap-8 px-5 pt-20 pb-10 sm:px-10 sm:pt-24 sm:pb-12 lg:h-full lg:grid-cols-[minmax(0,1fr)_auto] lg:gap-16 lg:px-14">
        <div className="max-w-[640px]">
          <Badge variant="outline" className={emberEyebrow}>
            <span className="h-1.5 w-1.5 rounded-full bg-[#FFA102]" />
            AI-Powered
          </Badge>
          <h1
            id="hero-title"
            className="ember-display m-0 mt-5 text-[clamp(2.7rem,13vw,7.2rem)] leading-[.78] sm:mt-6 lg:text-[clamp(3.6rem,8vw,7.2rem)]"
          >
            Edit talking
            <br />
            head shorts
            <br />
            <span className="text-[#FFA102]">
              <span className="mr-3 inline-block origin-left scale-[1.16] sm:mr-10 sm:scale-[1.28]">
                10x
              </span>
              {"    "}
              faster
            </span>
          </h1>
          <p className="mt-5 max-w-[34rem] text-base leading-[1.35] text-[#F5F9CE]/70 sm:mt-6 sm:text-lg">
            From raw talking head video to a post-ready Short in 1 click. Cut,
            caption, SFX, and more — so you can focus on building your personal
            brand.
          </p>
          {showDrop ? (
            <LandingDropZone
              className="mt-6 sm:mt-8"
              phase={trial.phase}
              disabled={trial.locked}
              acceptFiles={trial.acceptFiles}
            />
          ) : null}
        </div>
        <div className="flex justify-center lg:block">
          <LandingTrialStage
            phase={trial.phase}
            projectId={trial.projectId}
            project={trial.project}
            progress={progress}
            uploadProgress={trial.uploadProgress}
          />
        </div>
      </div>
    </section>
  );
}
