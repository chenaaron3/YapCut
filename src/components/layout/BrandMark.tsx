import { cn } from "~/lib/utils";

type Props = {
  className?: string;
  light?: boolean;
};

export function BrandMark({ className, light }: Props) {
  return (
    <span className={cn("flex items-center gap-3 text-lg font-semibold leading-none", className)}>
      <span className="grid h-9 w-9 -rotate-6 place-items-center rounded-[8px] border-2 border-[#450E16] bg-[#FFA102] text-sm font-bold text-[#450E16] shadow-[4px_4px_0_#450E16]">
        TH
      </span>
      <span className={light ? "text-[#F5F9CE]" : undefined}>talking head</span>
    </span>
  );
}
