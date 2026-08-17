"use client";

import {
  StoryEdit,
  StoryShare,
  StoryTranscript,
  StoryUpload,
} from "~/components/landing/story-panels";
import {
  spanProgress,
  usePinnedStory,
} from "~/components/landing/use-story-progress";
import { cn } from "~/lib/utils";

const STEPS = [
  { n: "01", label: "Drop it in" },
  { n: "02", label: "Let it read" },
  { n: "03", label: "Make it yours" },
  { n: "04", label: "Share it" },
] as const;

const PANELS = [StoryUpload, StoryTranscript, StoryEdit, StoryShare] as const;

export function LandingHowItWorks() {
  const { trackRef, progress, active, scrollToStep } = usePinnedStory(
    STEPS.length,
  );

  return (
    <section
      id="how-it-works"
      aria-labelledby="how-title"
      className="border-y-2 border-[#450E16]/20 bg-[#F5F9CE] px-5 py-12 sm:px-10 sm:py-16 lg:px-14 lg:py-20"
    >
      <div className="mx-auto max-w-[1280px]">
        <div className="max-w-[940px]">
          <p className="ember-mono mb-4 text-[10px] font-semibold tracking-[.2em] text-[#DD5533] uppercase">
            From first click to ready post
          </p>
          <h2
            id="how-title"
            className="ember-display m-0 text-[clamp(2.8rem,14vw,9rem)] leading-[.78] lg:text-[clamp(4rem,8.5vw,9rem)]"
          >
            Four steps.
            <br />
            <span className="text-[#432E6F]">That’s it.</span>
          </h2>
        </div>

        <div
          ref={trackRef}
          className="relative mt-8 min-h-[420vh] sm:mt-10 lg:min-h-[520vh]"
        >
          <div className="sticky top-0 z-10 flex min-h-dvh flex-col gap-4 py-4 lg:grid lg:grid-cols-[160px_minmax(0,1fr)] lg:items-center lg:gap-10 lg:py-6">
            <aside
              aria-label="How it works steps"
              className="flex shrink-0 flex-row justify-between gap-1 overflow-x-auto bg-[#F5F9CE]/90 py-2 backdrop-blur-sm lg:flex-col lg:justify-center lg:gap-6 lg:overflow-visible lg:bg-transparent lg:py-0 lg:backdrop-blur-none"
            >
              {STEPS.map((step, i) => (
                <button
                  key={step.n}
                  type="button"
                  aria-current={active === i ? "step" : undefined}
                  onClick={() => scrollToStep(i)}
                  className={cn(
                    "ember-nav-item shrink-0 !flex-col border-0 bg-transparent p-0 text-[10px] font-semibold sm:text-xs lg:!flex-row lg:text-base",
                    active === i && "is-active",
                  )}
                >
                  <span className="ember-nav-dot">{step.n}</span>
                  <span>{step.label}</span>
                </button>
              ))}
            </aside>

            <div className="relative mx-auto h-[min(380px,62dvh)] w-full max-w-[42rem] overflow-hidden rounded-[20px] border-2 border-[#FFA102] bg-[#450E16] text-[#F5F9CE] shadow-[6px_7px_0_rgba(69,14,22,.9)] sm:h-[380px] lg:h-[400px]">
              {PANELS.map((Panel, i) => {
                const step = STEPS[i];
                if (!step) return null;
                const local = spanProgress(
                  progress,
                  i / STEPS.length,
                  (i + 1) / STEPS.length,
                );
                const visible = active === i;
                return (
                  <div
                    key={step.n}
                    className={cn(
                      "absolute inset-0 p-3.5 transition-opacity duration-300 sm:p-4",
                      visible
                        ? "opacity-100"
                        : "pointer-events-none opacity-0",
                    )}
                    aria-hidden={!visible}
                  >
                    <Panel progress={local} />
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
