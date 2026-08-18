import { Plus } from "lucide-react";

import { Button } from "~/components/ui/button";

import { ProjectsToolbar } from "./ProjectsToolbar";

import type { ProjectStatusFilter } from "./types";

type Props = {
  loading: boolean;
  count: number;
  filteredCount: number;
  filtering: boolean;
  query: string;
  onQueryChange: (query: string) => void;
  status: ProjectStatusFilter;
  onStatusChange: (status: ProjectStatusFilter) => void;
  onCreate: () => void;
};

export function ProjectsHeader({
  loading,
  count,
  filteredCount,
  filtering,
  query,
  onQueryChange,
  status,
  onStatusChange,
  onCreate,
}: Props) {
  return (
    <div className="pt-10">
      <p className="ember-mono text-[10px] font-semibold tracking-[.2em] text-[#DD5533] uppercase">
        Library
      </p>
      <div className="mt-2 flex items-center justify-between gap-3">
        <h1 className="ember-display animate-rise min-w-0 text-5xl leading-[.82] sm:text-7xl">
          Projects
        </h1>
        <Button
          variant="ember"
          size="sm"
          className="animate-rise-delay-2 h-8 shrink-0 px-3 lg:hidden"
          onClick={onCreate}
        >
          <Plus data-icon="inline-start" />
          New project
        </Button>
        <div className="hidden min-w-0 shrink-0 items-center justify-end gap-3 lg:flex">
          {count > 0 ? (
            <ProjectsToolbar
              query={query}
              onQueryChange={onQueryChange}
              status={status}
              onStatusChange={onStatusChange}
            />
          ) : null}
          <Button
            variant="ember"
            size="lg"
            className="animate-rise-delay-2 h-11 shrink-0 px-4"
            onClick={onCreate}
          >
            <Plus data-icon="inline-start" />
            New project
          </Button>
        </div>
      </div>
      <p className="animate-rise-delay mt-2 text-sm text-[#432E6F]">
        {loading
          ? "Loading…"
          : count === 0
            ? "No edits yet"
            : filtering
              ? `${filteredCount} of ${count} project${count === 1 ? "" : "s"}`
              : `${count} project${count === 1 ? "" : "s"}`}
      </p>
    </div>
  );
}
