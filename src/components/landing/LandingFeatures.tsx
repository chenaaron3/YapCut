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
    title: "Cut by deleting words",
    payoff: "Save hours of tedious timeline cutting.",
    how: "AI automatically cuts the gaps and retakes. Change the words, the video follows.",
    Visual: MockTranscripts,
    Icon: AlignLeft,
    tilt: "md:rotate-[-1deg]",
  },
  {
    n: "02",
    title: "Looks directed on arrival",
    payoff: "Boost retention with a Short that already looks finished.",
    how: "Zooms, SFX, and overlays land on the words that matter.",
    Visual: MockEdits,
    Icon: Sparkles,
    tilt: "md:rotate-[1deg]",
  },
  {
    n: "03",
    title: "Tap a word, place the edit",
    payoff: "Keep every edit tied to the timing of the words.",
    how: "The timeline’s still there; you just don’t have to live in it.",
    Visual: MockWordView,
    Icon: TextCursorInput,
    tilt: "md:rotate-[1deg]",
  },
  {
    n: "04",
    title: "Your brand stays yours",
    payoff: "The first pass is automatic.",
    how: "Nudge, swap, or undo anything until the look matches the brand you want.",
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
      className="bg-[#F5F9CE] px-5 pb-16 sm:px-10 sm:pb-24 lg:px-14 lg:pb-28"
    >
      <div className="mx-auto max-w-[1280px]">
        <div className="border-t-2 border-[#450E16]/20 pt-12 sm:pt-16">
          <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
            <div>
              <p className="ember-mono mb-3 text-[10px] font-semibold tracking-[.2em] text-[#432E6F] uppercase">
                The new way to edit talking-head Shorts
              </p>
              <h2
                id="features-title"
                className="ember-display m-0 max-w-[940px] text-[clamp(2.6rem,12vw,6.6rem)] leading-[.8] lg:text-[clamp(3.4rem,6.5vw,6.6rem)]"
              >
                Remove the slow, skippable parts —{" "}
                <span className="text-[#DD5533]">
                  so you can shape the brand.
                </span>
              </h2>
            </div>
          </div>
        </div>
        <div className="mt-10 grid gap-3 md:grid-cols-2 lg:grid-cols-4">
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
              <div className="flex items-start justify-between gap-3 border-t-2 border-[#450E16] bg-[#F5F9CE] px-3.5 py-3.5 text-[#450E16]">
                <div className="flex min-w-0 flex-col gap-1.5">
                  <div className="flex items-baseline gap-2">
                    <span className="ember-mono text-[10px] font-semibold text-[#DD5533]">
                      {feature.n}
                    </span>
                    <h3 className="ember-display m-0 text-xl leading-tight sm:text-2xl">
                      {feature.title}
                    </h3>
                  </div>
                  <p className="m-0 text-sm leading-snug text-[#432E6F]">
                    <span className="font-semibold text-[#450E16]">
                      {feature.payoff}
                    </span>{" "}
                    {feature.how}
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
