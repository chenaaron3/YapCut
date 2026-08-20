import { getRun } from "workflow/api";

import { isTerminalProgressEvent } from "~/lib/workflow/ndjson";

import type { ProgressBus } from "~/server/workflow/progress-bus";

export type WorkflowProgressEvent = {
  stage: string;
};

export function workflowStreamStartIndex(request: Request): number | undefined {
  const raw = new URL(request.url).searchParams.get("startIndex");
  if (raw == null) return undefined;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) ? n : undefined;
}

function encodeNdjson(event: unknown): Uint8Array {
  return new TextEncoder().encode(`${JSON.stringify(event)}\n`);
}

function localProgressStream<Event extends WorkflowProgressEvent>(input: {
  id: string;
  snapshot: Event | null;
  bus: ProgressBus<Event>;
}): ReadableStream<Uint8Array> {
  let unsubscribe: (() => void) | undefined;
  return new ReadableStream<Uint8Array>({
    start(controller) {
      const initial = input.bus.last(input.id) ?? input.snapshot;
      if (initial) controller.enqueue(encodeNdjson(initial));
      if (initial && isTerminalProgressEvent(initial)) {
        controller.close();
        return;
      }
      unsubscribe = input.bus.subscribe(input.id, (event) => {
        try {
          controller.enqueue(encodeNdjson(event));
          if (isTerminalProgressEvent(event)) {
            unsubscribe?.();
            controller.close();
          }
        } catch {
          unsubscribe?.();
        }
      });
    },
    cancel() {
      unsubscribe?.();
    },
  });
}

/** `getReadable` when a run id exists, else the in-process bus. */
export function workflowProgressResponse<Event extends WorkflowProgressEvent>(input: {
  runId: string | null | undefined;
  startIndex?: number;
  snapshot: Event | null;
  bus: ProgressBus<Event>;
  id: string;
}): Response {
  const runId =
    input.runId != null && input.runId.length > 0 ? input.runId : null;
  const stream = runId
    ? getRun(runId).getReadable<string>({
        startIndex: input.startIndex,
      })
    : localProgressStream({
        id: input.id,
        snapshot: input.snapshot,
        bus: input.bus,
      });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      ...(runId ? { "x-workflow-run-id": runId } : {}),
    },
  });
}
