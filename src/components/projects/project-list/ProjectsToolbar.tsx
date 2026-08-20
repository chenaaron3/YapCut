import { ChevronDown, Search } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { Input } from "~/components/ui/input";
import {
  PROJECT_LIST_BADGE_LABEL,
  PROJECT_LIST_BADGES,
} from "~/domain/project/project-list-badge";
import { cn } from "~/lib/utils";

import type { ProjectStatusFilter } from "./types";

const FIELD =
  "h-11 rounded-[16px] border-2 border-[#450E16] bg-[#FFFEF2] text-sm text-[#450E16] shadow-[4px_4px_0_#450E16] outline-none focus-visible:border-[#450E16] focus-visible:ring-3 focus-visible:ring-[#FFA102]";

type Props = {
  query: string;
  onQueryChange: (query: string) => void;
  status: ProjectStatusFilter;
  onStatusChange: (status: ProjectStatusFilter) => void;
};

export function ProjectsToolbar({
  query,
  onQueryChange,
  status,
  onStatusChange,
}: Props) {
  const statusLabel =
    status === "all" ? "All statuses" : PROJECT_LIST_BADGE_LABEL[status];

  return (
    <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center">
      <label className="relative w-full sm:w-56">
        <span className="sr-only">Search projects</span>
        <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-[#432E6F]/55" />
        <Input
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Search projects…"
          className={cn(
            FIELD,
            "w-full py-0 pr-3 pl-10 placeholder:text-[#432E6F]/45",
          )}
        />
      </label>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <button
              type="button"
              aria-label="Filter by status"
              className={cn(
                FIELD,
                "inline-flex min-w-46 shrink-0 items-center justify-between gap-2 px-3.5 text-left",
              )}
            />
          }
        >
          <span className="min-w-0 truncate">{statusLabel}</span>
          <ChevronDown className="size-4 shrink-0 text-[#432E6F]/55" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" sideOffset={8} className="min-w-44">
          <DropdownMenuItem
            className={
              status === "all" ? "bg-[#FFA102] text-[#450E16]" : undefined
            }
            onClick={() => onStatusChange("all")}
          >
            All statuses
          </DropdownMenuItem>
          {PROJECT_LIST_BADGES.map((badge) => (
            <DropdownMenuItem
              key={badge}
              className={
                status === badge ? "bg-[#FFA102] text-[#450E16]" : undefined
              }
              onClick={() => onStatusChange(badge)}
            >
              {PROJECT_LIST_BADGE_LABEL[badge]}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
