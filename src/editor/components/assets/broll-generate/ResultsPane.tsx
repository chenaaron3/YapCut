import { cn } from "~/lib/utils";

import { ResultSlot } from "~/editor/components/assets/broll-generate/ResultSlot";
import { RESULT_SLOT_COUNT } from "~/editor/components/assets/broll-generate/types";

import type {
  Candidate,
  ImageSize,
} from "~/editor/components/assets/broll-generate/types";

export function ResultsPane({
  imageSize,
  pending,
  candidates,
  addedUrls,
  onAdd,
}: {
  imageSize: ImageSize;
  pending: boolean;
  candidates: Candidate[];
  addedUrls: ReadonlySet<string>;
  onAdd: (still: Candidate) => void;
}) {
  return (
    <section
      aria-label="Generated B-roll results"
      className="flex min-h-0 min-w-0 overflow-hidden px-8 py-6 max-md:px-5 max-md:py-5"
    >
      <div
        aria-live="polite"
        className={cn(
          "@container [container-type:size] flex h-full min-h-0 min-w-0 flex-1 items-center justify-center gap-4",
          imageSize === "landscape" ? "flex-col" : "flex-row",
        )}
      >
        {Array.from({ length: RESULT_SLOT_COUNT }, (_, i) => {
          const still = pending ? undefined : candidates[i];
          return (
            <ResultSlot
              key={still?.url ?? `placeholder-${i}`}
              still={still}
              pending={pending}
              imageSize={imageSize}
              added={still ? addedUrls.has(still.url) : false}
              onAdd={onAdd}
            />
          );
        })}
      </div>
    </section>
  );
}
