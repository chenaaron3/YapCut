import { createWriteStream } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { Readable } from "node:stream";
import type { ReadableStream as NodeWebReadableStream } from "node:stream/web";
import { pipeline } from "node:stream/promises";

import type { PublishMedia } from "~/schedule/publisher";

export type LocalMediaPaths = {
  dir: string;
  videoPath: string;
  coverPath: string;
};

async function downloadToFile(
  media: PublishMedia,
  destPath: string,
): Promise<void> {
  const res = await fetch(media.url);
  if (!res.ok || !res.body) {
    throw new Error(`Download failed ${res.status}: ${media.url}`);
  }
  const nodeStream = Readable.fromWeb(
    res.body as unknown as NodeWebReadableStream,
  );
  await pipeline(nodeStream, createWriteStream(destPath));
}

/** Download publish media to a temp dir; caller should dispose. */
export async function materializePublishMedia(options: {
  video: PublishMedia;
  cover: PublishMedia;
}): Promise<LocalMediaPaths> {
  const dir = await mkdtemp(path.join(tmpdir(), "th2-schedule-"));
  const videoPath = path.join(dir, "video.mp4");
  const coverPath = path.join(dir, "cover.jpg");
  await downloadToFile(options.video, videoPath);
  await downloadToFile(options.cover, coverPath);
  return { dir, videoPath, coverPath };
}

export async function disposeLocalMedia(paths: LocalMediaPaths): Promise<void> {
  await rm(paths.dir, { recursive: true, force: true });
}
