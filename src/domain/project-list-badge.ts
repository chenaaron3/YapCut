import type { ProjectStatus } from "~/domain/project-status";
import type { PlatformPublishStatus } from "~/domain/schedule";

export const PROJECT_LIST_BADGES = [
  "creating",
  "failed",
  "exporting",
  "ready",
  "scheduled",
  "publishing",
  "published",
  "publish_failed",
] as const;

export type ProjectListBadge = (typeof PROJECT_LIST_BADGES)[number];

export const PROJECT_LIST_BADGE_LABEL: Record<ProjectListBadge, string> = {
  creating: "Creating",
  failed: "Failed",
  exporting: "Exporting",
  ready: "Ready",
  scheduled: "Scheduled",
  publishing: "Publishing",
  published: "Published",
  publish_failed: "Publish failed",
};

export function projectListBadge(options: {
  status: ProjectStatus;
  scheduledAt: Date | string | null;
  publishStatuses: readonly PlatformPublishStatus[] | null;
}): ProjectListBadge {
  if (options.status === "processing") return "creating";
  if (options.status === "failed") return "failed";
  if (options.status === "exporting") return "exporting";

  const statuses = options.publishStatuses ?? [];
  if (options.scheduledAt != null && statuses.length > 0) {
    if (statuses.every((s) => s === "succeeded")) return "published";
    if (statuses.some((s) => s === "uploading")) return "publishing";
    if (statuses.some((s) => s === "failed")) return "publish_failed";
    const at =
      options.scheduledAt instanceof Date
        ? options.scheduledAt
        : new Date(options.scheduledAt);
    if (Number.isFinite(at.getTime()) && at.getTime() <= Date.now()) {
      return "publishing";
    }
    return "scheduled";
  }

  return "ready";
}
