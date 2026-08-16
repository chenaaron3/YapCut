import { ChevronDown } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { cn } from "~/lib/utils";

export type InspectorSelectOption = {
  value: string;
  label: string;
};

export function InspectorSelect({
  value,
  onChange,
  options,
  "aria-label": ariaLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  options: readonly InspectorSelectOption[];
  "aria-label"?: string;
}) {
  const selected = options.find((option) => option.value === value);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            aria-label={ariaLabel}
            className="flex h-8 w-full items-center gap-2 rounded-[10px] border border-[#F5F9CE]/20 bg-[#222632] px-2.5 text-left text-xs text-[#F5F9CE] outline-none hover:border-[#FFA102] focus-visible:border-[#FFA102] focus-visible:ring-2 focus-visible:ring-[#FFA102]/40"
          />
        }
      >
        <span className="min-w-0 flex-1 truncate">
          {selected?.label ?? "—"}
        </span>
        <ChevronDown className="size-3.5 shrink-0 text-[#F5F9CE]/50" />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        sideOffset={6}
        className="min-w-[var(--anchor-width,12rem)]"
      >
        {options.map((option) => (
          <DropdownMenuItem
            key={option.value}
            className={cn(
              "text-xs",
              option.value === value && "bg-[#FFA102] text-[#450E16]",
            )}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
