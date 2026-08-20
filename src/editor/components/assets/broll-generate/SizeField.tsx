import { cn } from "~/lib/utils";

import { SIZE_OPTIONS } from "~/editor/components/assets/broll-generate/types";

import type { ImageSize } from "~/editor/components/assets/broll-generate/types";

export function SizeField({
  imageSize,
  onChange,
}: {
  imageSize: ImageSize;
  onChange: (size: ImageSize) => void;
}) {
  return (
    <fieldset className="flex shrink-0 flex-col gap-2">
      <legend className="ember-mono text-[11px] font-medium tracking-[0.13em] text-[#c4b8a8]">
        SIZE
      </legend>
      <div
        role="group"
        aria-label="Generated image size"
        className="flex w-fit overflow-hidden rounded-xl border border-[#453239] bg-[#171922]"
      >
        {SIZE_OPTIONS.map(({ id, label, Icon }, i) => {
          const selected = imageSize === id;
          return (
            <button
              key={id}
              type="button"
              title={label}
              aria-label={label}
              aria-pressed={selected}
              className={cn(
                "grid size-12 place-items-center transition-colors outline-none focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-inset",
                i < SIZE_OPTIONS.length - 1 && "border-r border-[#453239]",
                selected
                  ? "bg-[#ffa102] text-[#450e16] hover:bg-[#ffaf2b] focus-visible:ring-[#f5f9ce]"
                  : "bg-transparent text-[#f5f9ce] hover:bg-[#222632] focus-visible:ring-[#ffa102]",
              )}
              onClick={() => onChange(id)}
            >
              <Icon className="size-6 stroke-[1.5]" />
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
