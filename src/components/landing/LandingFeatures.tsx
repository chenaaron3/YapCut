import {
  AlignLeft,
  MousePointerClick,
  Sparkles,
  TextCursorInput,
} from "lucide-react";

import {
  MockControl,
  MockEdits,
  MockTranscripts,
  MockWordView,
} from "~/components/landing/LandingFeatureMocks";
import { cn } from "~/lib/utils";

const FEATURES = [
  {
    n: "01",
    title: "AI transcripts",
    body: "Speech becomes words you can cut — plus perfectly timed subtitles, so nothing gets missed.",
    Visual: MockTranscripts,
    Icon: AlignLeft,
    tilt: "md:rotate-[-1deg]",
  },
  {
    n: "02",
    title: "AI edits",
    body: "AI places zooms, SFX, and text overlays with intention — edits that boost engagement.",
    Visual: MockEdits,
    Icon: Sparkles,
    tilt: "md:rotate-[1deg]",
  },
  {
    n: "03",
    title: "Word-based view",
    body: "A beginner-friendly editor built for talking head videos. No editing experience required.",
    Visual: MockWordView,
    Icon: TextCursorInput,
    tilt: "md:rotate-[1deg]",
  },
  {
    n: "04",
    title: "Take control",
    body: "AI is the sidekick. You stay in control — nudge, swap, or undo any treatment.",
    Visual: MockControl,
    Icon: MousePointerClick,
    tilt: "md:rotate-[-1deg]",
  },
] as const;

export function LandingFeatures() {
  return (
    <section
      id="features"
      aria-labelledby="features-title"
      className="bg-[#F5F9CE] px-6 pb-24 sm:px-10 lg:px-14 lg:pb-28"
    >
      <div className="mx-auto max-w-[1120px]">
        <div className="border-t-2 border-[#450E16]/20 pt-12 sm:pt-16">
          <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
            <div>
              <p className="ember-mono mb-3 text-[10px] font-semibold tracking-[.2em] text-[#432E6F] uppercase">
                A smaller toolkit
              </p>
              <h2
                id="features-title"
                className="ember-display m-0 max-w-[720px] text-[clamp(3.4rem,6.5vw,6.6rem)] leading-[.8]"
              >
                Your words are{" "}
                <span className="text-[#DD5533]">the timeline.</span>
              </h2>
            </div>
          </div>
        </div>
        <div className="mt-10 grid gap-5 md:grid-cols-2">
          {FEATURES.map((feature) => (
            <article
              key={feature.n}
              className={cn(
                "group flex h-full flex-col overflow-hidden rounded-[20px] border-2 border-[#450E16] bg-[#450E16] text-[#F5F9CE] shadow-[5px_6px_0_rgba(69,14,22,.9)] transition-transform duration-200 hover:-translate-y-1",
                feature.tilt,
              )}
            >
              <div className="flex flex-1 items-center justify-center">
                <feature.Visual />
              </div>
              <div className="flex items-start justify-between gap-3 border-t-2 border-[#450E16] bg-[#F5F9CE] px-4 py-3.5 text-[#450E16]">
                <div className="flex min-w-0 flex-col gap-1.5">
                  <div className="flex items-baseline gap-2.5">
                    <span className="ember-mono text-[10px] font-semibold text-[#DD5533]">
                      {feature.n}
                    </span>
                    <h3 className="ember-display m-0 text-2xl leading-none sm:text-3xl">
                      {feature.title}
                    </h3>
                  </div>
                  <p className="m-0 max-w-[38ch] text-sm leading-snug text-[#432E6F]">
                    {feature.body}
                  </p>
                </div>
                <feature.Icon className="mt-0.5 size-4 text-[#450E16]" />
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
