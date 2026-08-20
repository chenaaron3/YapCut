import { Check, Plus } from "lucide-react";

import { cn } from "~/lib/utils";

import { SLOT_BOX } from "~/editor/components/assets/broll-generate/types";

import type {
  Candidate,
  ImageSize,
} from "~/editor/components/assets/broll-generate/types";

export function ResultSlot({
  still,
  pending,
  imageSize,
  added,
  onAdd,
}: {
  still?: Candidate;
  pending: boolean;
  imageSize: ImageSize;
  added: boolean;
  onAdd: (still: Candidate) => void;
}) {
  return (
    <article
      className={cn(
        "group relative min-h-0 shrink-0 overflow-hidden rounded-xl",
        SLOT_BOX[imageSize],
        still
          ? "border border-[#453239] bg-[#171922] focus-within:border-[#ffa102]"
          : pending
            ? "border border-[#453239] bg-[#171922]"
            : "border border-dashed border-[#75677f]/65 bg-[#161922]",
      )}
    >
      {still ? (
        <img
          src={still.url}
          alt=""
          className="absolute inset-0 size-full object-contain"
        />
      ) : pending ? (
        <span role="status" className="absolute inset-0 grid place-items-center">
          <span className="shimmer shimmer-color-[#ffa102] shimmer-angle-45 ember-mono text-[0.8rem] tracking-[0.14em] text-[#c4b8a8] uppercase">
            Generating…
          </span>
        </span>
      ) : null}
      {still && added ? (
        <button
          type="button"
          disabled
          title="Already added to library"
          aria-label="Variant already added to library"
          className="absolute right-3 bottom-3 grid size-11 place-items-center rounded-full border border-[#ffa102] bg-[#1a1d26]/92 text-[#f5f9ce] outline-none"
        >
          <Check className="size-5 stroke-[1.8] text-[#ffa102]" />
        </button>
      ) : still ? (
        <button
          type="button"
          title="Add to library"
          aria-label="Add variant to library"
          disabled={added}
          className="absolute right-3 bottom-3 grid size-11 translate-y-1.5 place-items-center rounded-full border border-[#ffa102] bg-[#ffa102] text-[#450e16] opacity-0 transition-[opacity,transform,background-color] outline-none group-focus-within:translate-y-0 group-focus-within:opacity-100 group-hover:translate-y-0 group-hover:opacity-100 hover:bg-[#ffaf2b] focus-visible:translate-y-0 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-[#f5f9ce] focus-visible:ring-offset-2 focus-visible:ring-offset-[#450e14] disabled:opacity-50"
          onClick={() => onAdd(still)}
        >
          <Plus className="size-5 stroke-[1.8]" />
        </button>
      ) : null}
    </article>
  );
}
