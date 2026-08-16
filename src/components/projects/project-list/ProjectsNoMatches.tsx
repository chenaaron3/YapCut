import { Button } from "~/components/ui/button";

type Props = {
  onClear: () => void;
};

export function ProjectsNoMatches({ onClear }: Props) {
  return (
    <div className="mt-12 max-w-lg rounded-[24px] border-2 border-[#450E16] bg-[#F5F9CE] px-8 py-10 shadow-[6px_7px_0_#450E16]">
      <p className="ember-display text-2xl leading-none">No matching projects</p>
      <p className="mt-2 text-sm leading-relaxed text-[#432E6F]">
        Try a different name or status, or clear the filters.
      </p>
      <Button variant="ember" className="mt-5 h-11 px-4" onClick={onClear}>
        Clear filters
      </Button>
    </div>
  );
}
