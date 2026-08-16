import { useEffect, useMemo, useState } from "react";

import { PROJECT_LIST_BADGES } from "~/domain/project-list-badge";
import { api } from "~/utils/api";

import { projectTitle } from "./format";

import type { ProjectStatusFilter } from "./types";

export const PROJECT_PAGE_SIZE = 9;

export function useProjectList() {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<ProjectStatusFilter>("all");
  const [page, setPage] = useState(1);
  const projectsQuery = api.project.list.useQuery();
  const projects = projectsQuery.data ?? [];
  const count = projects.length;

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return projects.filter((project) => {
      if (status !== "all" && project.badge !== status) return false;
      if (!needle) return true;
      return projectTitle(project.title).toLowerCase().includes(needle);
    });
  }, [projects, query, status]);

  const availableStatuses = useMemo(
    () =>
      PROJECT_LIST_BADGES.filter((badge) =>
        projects.some((project) => project.badge === badge),
      ),
    [projects],
  );

  const filtering = query.trim().length > 0 || status !== "all";
  const pageCount = Math.max(1, Math.ceil(filtered.length / PROJECT_PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const pageItems = filtered.slice(
    (safePage - 1) * PROJECT_PAGE_SIZE,
    safePage * PROJECT_PAGE_SIZE,
  );

  useEffect(() => {
    setPage(1);
  }, [query, status]);

  useEffect(() => {
    if (status !== "all" && !availableStatuses.includes(status)) {
      setStatus("all");
    }
  }, [availableStatuses, status]);

  return {
    isLoading: projectsQuery.isLoading,
    isError: projectsQuery.isError,
    count,
    filteredCount: filtered.length,
    filtering,
    query,
    setQuery,
    status,
    setStatus,
    availableStatuses,
    pageItems,
    page: safePage,
    pageCount,
    setPage,
    isEmpty: projectsQuery.data?.length === 0,
    noMatches: count > 0 && filtered.length === 0,
    clearFilters: () => {
      setQuery("");
      setStatus("all");
    },
  };
}
