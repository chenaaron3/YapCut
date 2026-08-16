import Link from "next/link";

import { buttonVariants } from "~/components/ui/button";
import { cn } from "~/lib/utils";

type Props = {
  title?: string;
  detail?: string;
  backHref?: string;
  backLabel?: string;
};

export function EmberLoading({
  title = "Loading",
  detail = "Opening your edit…",
  backHref = "/projects",
  backLabel = "← Projects",
}: Props) {
  return (
    <div className="mx-auto max-w-lg pt-10" role="status" aria-live="polite">
      {backHref ? (
        <Link
          href={backHref}
          className={cn(
            buttonVariants({ variant: "ghost", size: "sm" }),
            "mb-8 -ml-2 text-[#432E6F]",
          )}
        >
          {backLabel}
        </Link>
      ) : null}
      <p className="ember-display animate-rise text-5xl leading-[.82] sm:text-6xl">
        {title}
      </p>
      <p className="animate-rise-delay mt-3 text-base text-[#432E6F]">{detail}</p>
      <div className="animate-rise-delay-2 mt-10">
        <div className="relative overflow-hidden rounded-[24px] border-2 border-[#450E16] bg-[#F5F9CE] shadow-[8px_9px_0_#450E16]">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-[radial-gradient(ellipse_at_top,#ffa10233,transparent_70%)]"
          />
          <div className="relative px-6 pt-7 pb-6 sm:px-8">
            <p className="ember-mono text-[10px] font-semibold tracking-[.2em] text-[#DD5533] uppercase">
              Just a moment
            </p>
            <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-[#450E16]/15">
              <div className="ember-indeterminate h-full w-2/5 rounded-full bg-[linear-gradient(90deg,#FFA102_0%,#FAD979_45%,#FFA102_100%)]" />
            </div>
            <p className="mt-3 text-sm text-[#432E6F]">Fetching your project</p>
          </div>
        </div>
      </div>
    </div>
  );
}
