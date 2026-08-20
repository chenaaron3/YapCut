import { useEffect, useRef, useState } from "react";

import { isTerminalProgressEvent } from "~/lib/workflow/ndjson";

/**
 * Consume workflow progress over HTTP NDJSON. Reconnects with startIndex
 * after function timeouts; does not poll.
 */
export function useWorkflowNdjsonStream<Event extends { stage: string }>(options: {
  url: string | null;
  enabled?: boolean;
  parse: (value: unknown) => Event | null;
  fallback?: Event | null;
  onEvent?: (event: Event) => void;
  onTerminal?: (event: Event) => void | Promise<void>;
}): Event | null {
  const {
    url,
    enabled = true,
    parse,
    fallback = null,
    onEvent,
    onTerminal,
  } = options;
  const [live, setLive] = useState<Event | null>(null);
  const startIndexRef = useRef(0);
  const terminalRef = useRef(false);
  const parseRef = useRef(parse);
  const onEventRef = useRef(onEvent);
  const onTerminalRef = useRef(onTerminal);
  parseRef.current = parse;
  onEventRef.current = onEvent;
  onTerminalRef.current = onTerminal;

  useEffect(() => {
    startIndexRef.current = 0;
    terminalRef.current = false;
    setLive(null);
  }, [url]);

  useEffect(() => {
    if (!enabled || url == null || url.length === 0) return;

    let cancelled = false;

    const apply = (event: Event) => {
      setLive(event);
      onEventRef.current?.(event);
      if (!isTerminalProgressEvent(event) || terminalRef.current) return;
      terminalRef.current = true;
      void onTerminalRef.current?.(event);
    };

    const run = async () => {
      let opened = false;
      while (!cancelled && !terminalRef.current) {
        try {
          const sep = url.includes("?") ? "&" : "?";
          const res = await fetch(
            `${url}${sep}startIndex=${startIndexRef.current}`,
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
            buffer += decodeNdjsonChunk(value);
            const lines = buffer.split("\n");
            buffer = lines.pop() ?? "";
            for (const line of lines) {
              const event = parseNdjsonLine(line, parseRef.current);
              if (event) apply(event);
            }
          }
          const tail = parseNdjsonLine(buffer, parseRef.current);
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
  }, [enabled, url]);

  return live ?? fallback;
}

function decodeNdjsonChunk(value: unknown): string {
  if (typeof value === "string") return value;
  if (value instanceof Uint8Array) {
    return new TextDecoder().decode(value);
  }
  if (value != null && typeof value === "object") {
    return `${JSON.stringify(value)}\n`;
  }
  return "";
}

function parseNdjsonLine<Event>(
  value: unknown,
  parse: (value: unknown) => Event | null,
): Event | null {
  const parsed = parse(value);
  if (parsed) return parsed;
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    return parse(JSON.parse(trimmed) as unknown);
  } catch {
    return null;
  }
}
