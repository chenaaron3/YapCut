import { keepPreviousData } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { api } from "~/utils/api";

import type { ProjectStatusFilter } from "./types";

export function useProjectList() {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [status, setStatus] = useState<ProjectStatusFilter>("all");
  const [page, setPage] = useState(1);

  useEffect(() => {
    const id = window.setTimeout(() => {
      setDebouncedQuery((current) => {
        if (current === query) return current;
        setPage(1);
        return query;
      });
    }, 300);
    return () => window.clearTimeout(id);
  }, [query]);

  const projectsQuery = api.project.list.useQuery(
    { page, query: debouncedQuery, status },
    { placeholderData: keepPreviousData },
  );
  const data = projectsQuery.data;
  const count = data?.total ?? 0;
  const filtering = query.trim().length > 0 || status !== "all";

  return {
    isLoading: projectsQuery.isLoading,
    isError: projectsQuery.isError,
    count,
    filteredCount: data?.filteredTotal ?? 0,
    filtering,
    query,
    setQuery,
    status,
    setStatus: (next: ProjectStatusFilter) => {
      setStatus(next);
      setPage(1);
    },
    pageItems: data?.items ?? [],
    page: data?.page ?? page,
    pageCount: data?.pageCount ?? 1,
    setPage,
    isEmpty: data?.total === 0,
    noMatches: (data?.total ?? 0) > 0 && data?.filteredTotal === 0,
    clearFilters: () => {
      setQuery("");
      setDebouncedQuery("");
      setStatus("all");
      setPage(1);
    },
  };
}
