"use client";

import dynamic from "next/dynamic";

import { landingSignIn } from "~/components/landing/landing-auth";
import { LandingHeroCompare } from "~/components/landing/LandingHeroCompare";
import { CreateProgressBar } from "~/components/projects/CreateProgressBar";
import { Button } from "~/components/ui/button";

import type { LandingTrialPhase } from "~/components/landing/use-landing-trial";
import type { CreateProgressEvent } from "~/domain/project/create-progress";
import type { RouterOutputs } from "~/utils/api";

const LandingPreviewPlayer = dynamic(
  () =>
    import("~/components/landing/LandingPreviewPlayer").then(
      (mod) => mod.LandingPreviewPlayer,
    ),
  { ssr: false },
);

type Project = NonNullable<RouterOutputs["project"]["byId"]>;

export function LandingTrialStage({
  phase,
  projectId,
  project,
  progress,
  uploadProgress,
}: {
  phase: LandingTrialPhase;
  projectId: string | null;
  project: Project | null;
  progress: CreateProgressEvent | null;
  uploadProgress: number;
}) {
  if (phase === "idle") {
    return <LandingHeroCompare />;
  }

  if (phase === "ready" && projectId) {
    return (
      <div className="flex w-full max-w-[320px] flex-col items-center gap-2 sm:w-auto sm:max-w-none sm:gap-2.5">
        <div className="relative flex h-[370px] w-full items-center justify-center sm:h-[400px] sm:w-[320px] lg:h-[420px] lg:w-[340px]">
          <LandingPreviewPlayer projectId={projectId} />
        </div>
        <div className="relative z-10 flex justify-center">
          <Button
            variant="ember"
            size="lg"
            className="h-auto rounded-[14px] px-5 py-2.5 shadow-[3px_3px_0_#FFA102] hover:shadow-none sm:rounded-[16px] sm:px-7 sm:py-3 sm:shadow-[4px_4px_0_#FFA102]"
            onClick={() => landingSignIn()}
          >
            <span className="ember-mono text-[10px] font-semibold tracking-[.12em] uppercase sm:text-xs">
              Export
            </span>
          </Button>
        </div>
      </div>
    );
  }

  const failed = phase === "failed";

  return (
    <div className="w-full max-w-[360px]">
      <CreateProgressBar
        event={failed ? (project?.createProgress ?? progress) : progress}
        failed={failed}
        failureReason={project?.failureReason}
        uploadProgress={phase === "uploading" ? uploadProgress : 1}
      />
    </div>
  );
}
