export const PROJECT_STATUSES = [
  "processing",
  "ready",
  "scheduled",
  "exporting",
  "failed",
] as const;

export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export function isProjectStatus(value: unknown): value is ProjectStatus {
  return (
    typeof value === "string" &&
    (PROJECT_STATUSES as readonly string[]).includes(value)
  );
}

export type EditorProjectStatus = Extract<
  ProjectStatus,
  "ready" | "scheduled" | "exporting"
>;

/** Editor, rename, config, AI, and media upload. */
export function isEditorProjectStatus(
  status: unknown,
): status is EditorProjectStatus {
  return (
    isProjectStatus(status) &&
    (status === "ready" || status === "scheduled" || status === "exporting")
  );
}

export function canStartProjectExport(status: ProjectStatus): boolean {
  return status === "ready" || status === "scheduled";
}
