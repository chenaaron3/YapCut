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
    <div className="flex flex-col gap-6 pt-10 lg:flex-row lg:items-end">
      <div className="shrink-0">
        <p className="ember-mono text-[10px] font-semibold tracking-[.2em] text-[#DD5533] uppercase">
          Library
        </p>
        <h1 className="ember-display animate-rise mt-2 text-5xl leading-[.82] sm:text-7xl">
          Projects
        </h1>
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
      <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
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
  );
}
