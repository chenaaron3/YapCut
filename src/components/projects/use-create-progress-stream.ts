import { isCreateProgressEvent } from "~/domain/project/create-progress";
import { useWorkflowNdjsonStream } from "~/lib/workflow/use-ndjson-stream";

import type { CreateProgressEvent } from "~/domain/project/create-progress";

/**
 * Consume create progress over HTTP streaming. Reconnects with startIndex
 * after function timeouts; does not poll project status.
 */
export function useCreateProgressStream(options: {
  projectId: string;
  enabled: boolean;
  fallback: CreateProgressEvent | null;
  onTerminal?: () => void;
}): CreateProgressEvent | null {
  const { projectId, enabled, fallback, onTerminal } = options;
  return useWorkflowNdjsonStream({
    url:
      enabled && projectId.length > 0
        ? `/api/projects/${encodeURIComponent(projectId)}/create-stream`
        : null,
    enabled,
    parse: (value) => (isCreateProgressEvent(value) ? value : null),
    fallback,
    onTerminal: () => onTerminal?.(),
  });
}
