"use client";

import { StoryEdit, StoryExport, StoryTranscript, StoryUpload } from "~/components/landing/story-panels";
import { emberCard } from "~/components/landing/landing-ui";
import { useStoryProgress } from "~/components/landing/use-story-progress";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import { cn } from "~/lib/utils";

const STEPS = [
  { id: "story-upload", n: "01", label: "Drop it in" },
  { id: "story-read", n: "02", label: "Let it read" },
  { id: "story-edit", n: "03", label: "Make it yours" },
  { id: "story-export", n: "04", label: "Export it" },
] as const;

const STEP_IDS = STEPS.map((s) => s.id);

export function LandingHowItWorks() {
  const { progress, active } = useStoryProgress(STEP_IDS);

  return (
    <section
      id="how-it-works"
      aria-labelledby="how-title"
      className="border-y-2 border-[#450E16]/20 bg-[#F5F9CE] px-6 py-24 sm:px-10 lg:px-14 lg:py-32"
    >
      <div className="mx-auto max-w-[1280px]">
        <div className="mb-10 max-w-[940px] sm:mb-14">
          <p className="ember-mono mb-4 text-[10px] font-semibold tracking-[.2em] text-[#DD5533] uppercase">
            How it works
          </p>
          <h2
            id="how-title"
            className="ember-display m-0 text-[clamp(3.6rem,7.5vw,8rem)] leading-[.78]"
          >
            Four moves.
            <br />
            <span className="text-[#432E6F]">That’s it.</span>
          </h2>
        </div>

        <div className="grid items-start gap-6 lg:grid-cols-[0.32fr_1fr] lg:gap-16">
          <aside
            aria-label="How it works steps"
            className="sticky top-0 z-20 -mx-6 border-b-2 border-[#450E16]/15 bg-[#F5F9CE]/90 px-6 py-3 backdrop-blur-md sm:-mx-8 sm:px-8 lg:top-0 lg:mx-0 lg:flex lg:h-svh lg:items-center lg:border-b-0 lg:bg-transparent lg:px-0 lg:py-0 lg:backdrop-blur-none"
          >
            <nav aria-label="Journey steps" className="flex items-center gap-2 lg:hidden">
              {STEPS.map((step, i) => (
                <Button
                  key={step.id}
                  variant={active === i ? "ember" : "outline"}
                  size="sm"
                  nativeButton={false}
                  render={<a href={`#${step.id}`} />}
                  aria-current={active === i ? "step" : undefined}
                  className={cn(
                    "h-9 min-w-0 rounded-full border-2 border-[#450E16] text-[11px] font-semibold",
                    active === i
                      ? "flex-1 shadow-[3px_3px_0_#450E16]"
                      : "w-9 justify-center bg-[#F5F9CE] px-0 text-[#450E16]/50",
                  )}
                >
                  <span className="grid size-9 place-items-center">{i + 1}</span>
                  {active === i ? (
                    <span className="truncate pr-3">{step.label}</span>
                  ) : null}
                </Button>
              ))}
            </nav>
            <div className="relative hidden pl-8 lg:block">
              <div className="absolute top-2 bottom-2 left-9 w-px bg-linear-to-b from-[#FFA102] via-[#DD5533]/50 to-[#450E16]/15" />
              <nav aria-label="Journey steps" className="space-y-7">
                {STEPS.map((step, i) => (
                  <a
                    key={step.id}
                    href={`#${step.id}`}
                    aria-current={active === i ? "step" : undefined}
                    className={cn(
                      "group relative block",
                      active === i ? "text-[#450E16]" : "text-[#450E16]/40",
                    )}
                  >
                    <Badge
                      variant="outline"
                      className={cn(
                        "absolute -left-1 top-1/2 grid size-4 -translate-y-1/2 place-items-center rounded-full border p-0 text-[8px] font-bold",
                        active === i
                          ? "border-[#FFA102] bg-[#FFA102] text-[#450E16] shadow-[0_0_0_6px_rgba(255,161,2,.18)]"
                          : "border-[#450E16]/30 bg-[#F5F9CE] text-[#450E16]/50",
                      )}
                    >
                      {i + 1}
                    </Badge>
                    <div
                      className={cn(
                        "ember-display pl-5 text-xl leading-none",
                        active === i ? "opacity-100" : "opacity-65 group-hover:opacity-100",
                      )}
                    >
                      {step.label}
                    </div>
                    <div className="ember-mono pl-5 pt-1 text-[9px] tracking-[.16em] uppercase">
                      {step.n}
                    </div>
                  </a>
                ))}
              </nav>
            </div>
          </aside>

          <div>
            {STEPS.map((step, i) => (
              <div
                key={step.id}
                id={step.id}
                className="relative min-h-[220vh] scroll-mt-28 lg:scroll-mt-8"
              >
                <Card
                  className={cn(
                    emberCard,
                    "sticky top-20 border-[#FFA102] bg-[#450E16] text-[#F5F9CE] lg:top-[max(1.5rem,calc(50svh-18rem))]",
                  )}
                >
                  <CardContent className="pt-(--card-spacing)">
                    {i === 0 ? <StoryUpload progress={progress[0] ?? 0} /> : null}
                    {i === 1 ? (
                      <StoryTranscript progress={progress[1] ?? 0} />
                    ) : null}
                    {i === 2 ? <StoryEdit progress={progress[2] ?? 0} /> : null}
                    {i === 3 ? <StoryExport progress={progress[3] ?? 0} /> : null}
                  </CardContent>
                </Card>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
