import { AudioLines, Check, CircleAlert, Sparkles, Upload } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import {
  clampProgress,
  CREATE_STAGE_LABEL,
  CREATE_STAGE_WEIGHT,
  CREATE_UPLOAD_LABEL,
  failedPipelineProgress,
  overallCreateProgress,
} from "~/domain/create-progress";
import { cn } from "~/lib/utils";

import type {
  CreateProgressEvent,
  CreateProgressStage,
} from "~/domain/create-progress";

const PIPELINE_STEPS = ["upload", "media", "ai_analysis"] as const;
type PipelineStep = (typeof PIPELINE_STEPS)[number];

const STEP_META: Record<
  PipelineStep,
  { title: string; Icon: typeof AudioLines }
> = {
  upload: { title: "Upload", Icon: Upload },
  media: { title: "Transcribe", Icon: AudioLines },
  ai_analysis: { title: "AI analysis", Icon: Sparkles },
};

type StepVisual = "pending" | "active" | "done" | "error";

function failedStep(
  event: CreateProgressEvent,
): Exclude<PipelineStep, "upload"> {
  const pipeline = failedPipelineProgress(event);
  if (pipeline < CREATE_STAGE_WEIGHT.media) return "media";
  return "ai_analysis";
}

function stepVisual(
  step: PipelineStep,
  event: CreateProgressEvent | null,
  uploadProgress: number,
): StepVisual {
  if (step === "upload") {
    return uploadProgress >= 1 ? "done" : "active";
  }
  if (uploadProgress < 1) return "pending";

  const stage: CreateProgressStage = event?.stage ?? "media";
  if (event?.stage === "failed") {
    const failed = failedStep(event);
    const order = PIPELINE_STEPS.indexOf(step);
    const failAt = PIPELINE_STEPS.indexOf(failed);
    if (order < failAt) return "done";
    if (order === failAt) return "error";
    return "pending";
  }
  if (stage === "ready") return "done";
  const current = PIPELINE_STEPS.indexOf(
    stage === "media" || stage === "ai_analysis" ? stage : "media",
  );
  const order = PIPELINE_STEPS.indexOf(step);
  if (order < current) return "done";
  if (order === current) return "active";
  return "pending";
}

function stepFill(
  step: PipelineStep,
  visual: StepVisual,
  event: CreateProgressEvent | null,
  uploadProgress: number,
): number {
  if (visual === "done") return 1;
  if (visual === "pending" || visual === "error") return 0;
  if (step === "upload") return clampProgress(uploadProgress);
  if (!event) return 0;
  if (event.stage === step) return clampProgress(event.progress);
  return 0;
}

function useSmoothPercent(target: number): number {
  const [shown, setShown] = useState(target);
  const shownRef = useRef(target);

  useEffect(() => {
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      shownRef.current = target;
      setShown(target);
      return;
    }
    const start = shownRef.current;
    const t0 = performance.now();
    const duration = 480;
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - t0) / duration);
      const eased = 1 - (1 - t) ** 3;
      const next = start + (target - start) * eased;
      shownRef.current = next;
      setShown(next);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target]);

  return shown;
}

type Props = {
  event: CreateProgressEvent | null;
  failed?: boolean;
  failureReason?: string | null;
  /** 0–1 client upload. Defaults to 1 (already complete on the project page). */
  uploadProgress?: number;
};

export function CreateProgressBar({
  event,
  failed,
  failureReason,
  uploadProgress = 1,
}: Props) {
  const upload = clampProgress(uploadProgress);
  const overall = overallCreateProgress(event, upload);
  const smooth = useSmoothPercent(overall);
  const pct = Math.round(smooth * 100);
  const uploading = upload < 1;
  const headline = failed
    ? "Couldn’t finish creating"
    : event?.stage === "ready"
      ? "Ready"
      : "Building your edit";
  const label = uploading
    ? CREATE_UPLOAD_LABEL
    : (event?.label ?? CREATE_STAGE_LABEL.media);

  return (
    <div className="relative overflow-hidden rounded-[24px] border-2 border-[#450E16] bg-[#F5F9CE] shadow-[8px_9px_0_#450E16]">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-[radial-gradient(ellipse_at_top,#ffa10233,transparent_70%)]"
      />
      <div className="relative px-6 pt-7 pb-6 sm:px-8">
        <p className="ember-mono text-[10px] font-semibold tracking-[.2em] text-[#DD5533] uppercase">
          Create
        </p>
        <div className="mt-2 flex items-end justify-between gap-4">
          <h2 className="ember-display text-3xl leading-none sm:text-4xl">
            {headline}
          </h2>
          <p
            className={cn(
              "ember-display font-semibold tracking-tight tabular-nums",
              failed
                ? "text-2xl text-[#BC2D29]"
                : "text-4xl text-[#DD5533] sm:text-5xl",
            )}
          >
            {failed ? "—" : `${pct}%`}
          </p>
        </div>
        <div
          className="mt-5 h-1.5 overflow-hidden rounded-full bg-[#450E16]/15"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={failed ? undefined : pct}
          aria-label={
            uploading
              ? CREATE_UPLOAD_LABEL
              : (event?.label ?? CREATE_STAGE_LABEL.media)
          }
        >
          <div
            className={cn(
              "h-full rounded-full transition-[width] duration-500 ease-out",
              failed ? "bg-[#BC2D29]" : "bg-[#FFA102]",
              !failed &&
                "animate-create-shimmer bg-[linear-gradient(90deg,#FFA102_0%,#FAD979_45%,#FFA102_100%)]",
            )}
            style={{ width: `${Math.max(failed ? pct : pct, 2)}%` }}
          />
        </div>
        {failed && failureReason ? (
          <p className="mt-4 text-sm leading-relaxed text-[#BC2D29]">
            {failureReason}
          </p>
        ) : (
          <p className="mt-3 text-sm text-[#432E6F]">{label}</p>
        )}
      </div>

      <ol className="border-foreground/8 relative border-t px-6 py-5 sm:px-8">
        {PIPELINE_STEPS.map((step, i) => {
          const visual = stepVisual(step, event, upload);
          const fill = stepFill(step, visual, event, upload);
          const { title, Icon } = STEP_META[step];
          const isLast = i === PIPELINE_STEPS.length - 1;
          return (
            <li key={step} className="relative flex gap-4 pb-6 last:pb-0">
              {!isLast ? (
                <span
                  aria-hidden
                  className="bg-border absolute top-10 bottom-0 left-[15px] w-px overflow-hidden"
                >
                  <span
                    className={cn(
                      "absolute inset-x-0 top-0 w-px origin-top bg-[#FFA102] transition-transform duration-700 ease-out",
                      visual === "done"
                        ? "h-full scale-y-100"
                        : "h-full scale-y-0",
                    )}
                  />
                </span>
              ) : null}
              <div
                className={cn(
                  "relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full ring-1 transition-colors duration-300",
                  visual === "done" &&
                    "bg-[#FFA102] text-[#450E16] ring-[#FFA102]",
                  visual === "active" &&
                    "animate-create-step-pulse bg-[#FFA102]/20 text-[#DD5533] ring-[#FFA102]",
                  visual === "pending" &&
                    "bg-[#F5F9CE] text-[#75677F] ring-[#450E16]/20",
                  visual === "error" &&
                    "bg-[#BC2D29]/15 text-[#BC2D29] ring-[#BC2D29]/50",
                )}
              >
                {visual === "done" ? (
                  <Check className="animate-create-check-pop size-4" />
                ) : visual === "error" ? (
                  <CircleAlert className="size-4" />
                ) : (
                  <Icon
                    className={cn(
                      "size-4",
                      visual === "active" && "animate-pulse",
                    )}
                  />
                )}
              </div>
              <div className="min-w-0 flex-1 pt-0.5">
                <div className="flex items-baseline justify-between gap-3">
                  <p
                    className={cn(
                      "text-sm font-medium tracking-tight transition-colors",
                      visual === "pending"
                        ? "text-muted-foreground"
                        : "text-foreground",
                    )}
                  >
                    {title}
                  </p>
                  <p className="text-muted-foreground text-xs tabular-nums">
                    {visual === "done"
                      ? "Done"
                      : visual === "error"
                        ? "Failed"
                        : visual === "active"
                          ? `${Math.round(fill * 100)}%`
                          : "Waiting"}
                  </p>
                </div>
                <div className="bg-muted mt-2 h-1 overflow-hidden rounded-full">
                  <div
                    className={cn(
                      "h-full rounded-full transition-[width] duration-500 ease-out",
                      visual === "error" ? "bg-[#BC2D29]" : "bg-[#FFA102]",
                    )}
                    style={{
                      width: `${Math.round(fill * 100)}%`,
                    }}
                  />
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
