import { useEffect, useRef, useState } from "react";

import { isCreateProgressEvent } from "~/domain/project/create-progress";

import type { CreateProgressEvent } from "~/domain/project/create-progress";

function parseChunk(value: unknown): CreateProgressEvent | null {
  if (isCreateProgressEvent(value)) return value;
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    const parsed: unknown = JSON.parse(trimmed);
    return isCreateProgressEvent(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function decodeRead(value: unknown): string {
  if (typeof value === "string") return value;
  if (value instanceof Uint8Array) {
    return new TextDecoder().decode(value);
  }
  if (isCreateProgressEvent(value)) {
    return `${JSON.stringify(value)}\n`;
  }
  return "";
}

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
  const [live, setLive] = useState<CreateProgressEvent | null>(null);
  const startIndexRef = useRef(0);
  const terminalRef = useRef(false);
  const onTerminalRef = useRef(onTerminal);
  onTerminalRef.current = onTerminal;

  useEffect(() => {
    startIndexRef.current = 0;
    terminalRef.current = false;
    setLive(null);
  }, [projectId]);

  useEffect(() => {
    if (!enabled || projectId.length === 0) return;

    let cancelled = false;

    const apply = (event: CreateProgressEvent) => {
      setLive(event);
      if (event.stage === "ready" || event.stage === "failed") {
        terminalRef.current = true;
        onTerminalRef.current?.();
      }
    };

    const run = async () => {
      let opened = false;
      while (!cancelled && !terminalRef.current) {
        try {
          const res = await fetch(
            `/api/projects/${encodeURIComponent(projectId)}/create-stream?startIndex=${startIndexRef.current}`,
          );
          if (res.status === 401) return;
          if (!res.ok || !res.body) {
            if (!opened) return;
            await new Promise((r) => setTimeout(r, 1000));
            continue;
          }

          opened = true;
          const reader = res.body.getReader();
          let buffer = "";
          while (!cancelled && !terminalRef.current) {
            const { done, value } = await reader.read();
            if (done) break;
            startIndexRef.current += 1;
            buffer += decodeRead(value);
            const lines = buffer.split("\n");
            buffer = lines.pop() ?? "";
            for (const line of lines) {
              const event = parseChunk(line);
              if (event) apply(event);
            }
          }
          const tail = parseChunk(buffer);
          if (tail) apply(tail);
        } catch {
          if (cancelled) return;
        }
        if (terminalRef.current) return;
        await new Promise((r) => setTimeout(r, 1000));
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [enabled, projectId]);

  return live ?? fallback;
}
