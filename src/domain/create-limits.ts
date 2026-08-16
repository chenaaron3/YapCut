/** Caps for A-roll project create (drop upload + `createStart` / `createAddFiles` + verify). */

export const CREATE_MAX_CLIPS = 12;
export const CREATE_MAX_DURATION_SEC = 20 * 60;
export const CREATE_MAX_BYTES = 4 * 1024 * 1024 * 1024;
export const CREATE_MAX_LONG_EDGE_PX = 1920;

export const CREATE_LIMITS_HINT = `Up to ${CREATE_MAX_CLIPS} clips · ${CREATE_MAX_DURATION_SEC / 60} min · 4 GB · 1080p`;

export type CreateMediaInput = {
  filename: string;
  size: number;
  durationSec: number;
  width: number;
  height: number;
};

export type CreateLimitCode =
  "count" | "file-size" | "total-size" | "duration" | "resolution";

export type CreateUsed = {
  count: number;
  bytes: number;
  durationSec: number;
};

export function longEdgePx(width: number, height: number): number {
  return Math.max(width, height);
}

export function createLimitMessage(
  code: CreateLimitCode,
  filename?: string,
): string {
  const named = filename ? ` (${filename})` : "";
  switch (code) {
    case "count":
      return `Projects can have up to ${CREATE_MAX_CLIPS} clips.`;
    case "file-size":
      return `Each clip must be 4 GB or smaller${named}.`;
    case "total-size":
      return `Project footage can be up to 4 GB total${named}.`;
    case "duration":
      return `Project footage can be up to ${CREATE_MAX_DURATION_SEC / 60} minutes${named}.`;
    case "resolution":
      return `Clips must be 1080p or smaller (${CREATE_MAX_LONG_EDGE_PX}px on the long edge)${named}.`;
  }
}

export function createFileLimit(
  file: CreateMediaInput,
  used: CreateUsed,
): CreateLimitCode | null {
  if (used.count >= CREATE_MAX_CLIPS) return "count";
  if (file.size > CREATE_MAX_BYTES) return "file-size";
  if (used.bytes + file.size > CREATE_MAX_BYTES) return "total-size";
  if (longEdgePx(file.width, file.height) > CREATE_MAX_LONG_EDGE_PX) {
    return "resolution";
  }
  if (file.durationSec > CREATE_MAX_DURATION_SEC) return "duration";
  if (used.durationSec + file.durationSec > CREATE_MAX_DURATION_SEC) {
    return "duration";
  }
  return null;
}

export function usedFromCreateFiles(files: CreateMediaInput[]): CreateUsed {
  return files.reduce<CreateUsed>(
    (used, file) => ({
      count: used.count + 1,
      bytes: used.bytes + file.size,
      durationSec: used.durationSec + file.durationSec,
    }),
    { count: 0, bytes: 0, durationSec: 0 },
  );
}

/** Throws the first limit message. Empty batch is allowed (caller checks). */
export function assertCreateBatch(files: CreateMediaInput[]): void {
  const used: CreateUsed = { count: 0, bytes: 0, durationSec: 0 };
  for (const file of files) {
    const code = createFileLimit(file, used);
    if (code) {
      throw new Error(createLimitMessage(code, file.filename));
    }
    used.count += 1;
    used.bytes += file.size;
    used.durationSec += file.durationSec;
  }
}

export function summarizeCreateRejections(
  rejected: Array<{ filename: string; code: CreateLimitCode }>,
): string {
  if (rejected.length === 0) return "";
  const first = rejected[0]!;
  const head = createLimitMessage(first.code, first.filename);
  if (rejected.length === 1) return head;
  return `${head} ${rejected.length} videos weren’t added.`;
}

export function assertCreateUploadBytes(
  files: Array<{
    contentLength?: number;
    originalFilename?: string | null;
  }>,
): void {
  let total = 0;
  for (const file of files) {
    const bytes = file.contentLength;
    const name = file.originalFilename ?? undefined;
    if (bytes == null) {
      throw new Error(`Could not read size for ${name ?? "upload"}`);
    }
    if (bytes > CREATE_MAX_BYTES) {
      throw new Error(createLimitMessage("file-size", name));
    }
    total += bytes;
  }
  if (total > CREATE_MAX_BYTES) {
    throw new Error(createLimitMessage("total-size"));
  }
}
