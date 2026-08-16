import { Plus } from "lucide-react";

type Props = {
  onCreate: () => void;
};

export function ProjectsEmptyLibrary({ onCreate }: Props) {
  return (
    <button
      type="button"
      onClick={onCreate}
      className="animate-rise-delay-2 mt-12 flex w-full max-w-lg flex-col items-start rounded-[24px] border-2 border-dashed border-[#450E16] bg-[#F5F9CE] px-8 py-12 text-left shadow-[6px_7px_0_#450E16] transition hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-[3px_3px_0_#450E16]"
    >
      <span className="flex size-10 items-center justify-center rounded-full border-2 border-[#450E16] bg-[#FFA102] text-[#450E16]">
        <Plus className="size-5" />
      </span>
      <span className="ember-display mt-5 text-2xl leading-none">
        Create your first edit
      </span>
      <span className="mt-2 max-w-sm text-sm leading-relaxed text-[#432E6F]">
        Drop in A-roll. We’ll transcribe, measure, and seed AI so you can cut
        from the transcript.
      </span>
    </button>
  );
}
