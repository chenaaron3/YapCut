/** Project exists but the create pipeline has not started. */
export function isDraftCreate(project: {
  status: string;
  createProgress: unknown;
  workflowRunId: string | null;
}): boolean {
  return (
    project.status === "processing" &&
    project.createProgress == null &&
    (project.workflowRunId == null || project.workflowRunId.length === 0)
  );
}
