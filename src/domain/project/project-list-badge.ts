import type { ProjectStatus } from "~/domain/project/project-status";

export const PROJECT_LIST_PAGE_SIZE = 6;

export function projectTitle(title: string | null): string {
  const trimmed = title?.trim() ?? "";
  return trimmed.length > 0 ? trimmed : "Untitled";
}

export const PROJECT_LIST_BADGES = [
  "creating",
  "failed",
  "exporting",
  "ready",
  "scheduled",
] as const;

export type ProjectListBadge = (typeof PROJECT_LIST_BADGES)[number];

export const PROJECT_LIST_BADGE_LABEL: Record<ProjectListBadge, string> = {
  creating: "Creating",
  failed: "Failed",
  exporting: "Exporting",
  ready: "Ready",
  scheduled: "Scheduled",
};

export function projectListBadge(status: ProjectStatus): ProjectListBadge {
  if (status === "processing") return "creating";
  return status;
}
