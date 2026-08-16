import { emberCard } from "~/components/landing/landing-ui";
import { Badge } from "~/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { cn } from "~/lib/utils";

export function LandingFeatures() {
  return (
    <section
      id="features"
      aria-labelledby="features-title"
      className="bg-[#F5F9CE] px-6 pb-28 sm:px-10 lg:px-14 lg:pb-40"
    >
      <div className="mx-auto max-w-[1120px]">
        <div className="border-t-2 border-[#450E16]/20 pt-16">
          <p className="ember-mono mb-3 text-[10px] font-semibold tracking-[.2em] text-[#432E6F] uppercase">
            Built for Shorts
          </p>
          <h2
            id="features-title"
            className="ember-display m-0 max-w-[780px] text-[clamp(3.4rem,6.5vw,6.6rem)] leading-[.78]"
          >
            Your words are <span className="text-[#DD5533]">the timeline.</span>
          </h2>
        </div>
        <div className="mt-16 grid gap-5 sm:grid-cols-2">
          <Card
            className={cn(
              emberCard,
              "relative min-h-[260px] bg-[#BC2D29] text-[#F5F9CE] sm:rotate-[-1deg]",
            )}
          >
            <CardHeader>
              <p className="ember-mono m-0 text-[10px] font-semibold tracking-[.18em] text-[#FFA102] uppercase">
                01 / drop on a word
              </p>
              <CardTitle className="ember-display mt-4 max-w-[16ch] text-4xl leading-[.86] font-bold sm:text-5xl">
                Place the feeling where it lands.
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Badge className="absolute right-6 bottom-5 h-auto rotate-[8deg] rounded-[12px] border-2 border-[#450E16] bg-[#FFA102] px-3 py-2 text-sm font-semibold text-[#450E16] shadow-[4px_4px_0_#450E16]">
                clicks.
              </Badge>
            </CardContent>
          </Card>
          <Card
            className={cn(
              emberCard,
              "relative min-h-[260px] bg-[#432E6F] text-[#F5F9CE] sm:rotate-[1.5deg]",
            )}
          >
            <CardHeader>
              <p className="ember-mono m-0 text-[10px] font-semibold tracking-[.18em] text-[#FFA102] uppercase">
                02 / word-based
              </p>
              <CardTitle className="ember-display mt-4 max-w-[14ch] text-4xl leading-[.86] font-bold sm:text-5xl">
                Edit the sentence. Not the maze.
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-lg text-[#F5F9CE]/75">
                I think{" "}
                <span className="text-[#DD5533] line-through decoration-2">
                  um, you know,
                </span>{" "}
                the idea is{" "}
                <span className="rounded-[5px] bg-[#FFA102] px-1 text-[#450E16]">
                  simple.
                </span>
              </p>
            </CardContent>
          </Card>
          <Card
            className={cn(
              emberCard,
              "relative min-h-[260px] bg-[#FFA102] text-[#450E16] sm:rotate-[1deg]",
            )}
          >
            <CardHeader>
              <p className="ember-mono m-0 text-[10px] font-semibold tracking-[.18em] uppercase">
                03 / talking-head only
              </p>
              <CardTitle className="ember-display mt-4 max-w-[14ch] text-4xl leading-[.86] font-bold sm:text-5xl">
                Vertical Shorts. That’s the whole product.
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Badge
                variant="outline"
                className="ember-mono absolute right-5 bottom-5 h-auto rounded-full border-2 border-[#450E16] bg-[#F5F9CE] px-3 py-2 text-[10px] tracking-[.14em] text-[#450E16] uppercase shadow-[4px_4px_0_#450E16]"
              >
                9:16
              </Badge>
            </CardContent>
          </Card>
          <Card
            className={cn(
              emberCard,
              "relative min-h-[260px] bg-[#DD5533] text-[#F5F9CE] sm:-rotate-[1deg]",
            )}
          >
            <CardHeader>
              <p className="ember-mono m-0 text-[10px] font-semibold tracking-[.18em] text-[#FFA102] uppercase">
                04 / auto captions
              </p>
              <CardTitle className="ember-display mt-4 max-w-[12ch] text-4xl leading-[.86] font-bold sm:text-5xl">
                Say it. Style it.
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl leading-none font-semibold">
                The <span className="text-[#2DD4BF]">point</span> is to{" "}
                <span className="rounded-[6px] bg-[#FFA102] px-1 text-[#450E16]">
                  connect.
                </span>
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
}
