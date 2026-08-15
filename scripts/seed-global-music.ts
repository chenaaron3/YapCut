/**
 * Upload public/music to S3 and insert global Asset rows (`projectId` null).
 * Idempotent on `s3Key`. Re-uploads when local bytes differ or `--force`.
 * Measures LUFS. Prunes obsolete `global/music/` keys only.
 *
 * Usage:
 *   npm run seed:global
 *   npm run seed:global-music
 *   npm run seed:global-music -- --force
 *   npm run seed:global-music -- --dir /path/to/public/music
 */
import { readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { globalMusicKey, isGlobalMusicKey } from "~/server/media/keys";
import {
  parseSeedDirArgs,
  seedGlobalAudioLibrary,
} from "./lib/seed-global-audio";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_MUSIC_DIR = path.resolve(ROOT, "public/music");
const AUDIO_EXT = new Set([".wav", ".mp3", ".m4a", ".ogg", ".flac"]);

export async function seedGlobalMusic(options: {
  dir?: string;
  force: boolean;
}): Promise<void> {
  const musicDir = options.dir ?? DEFAULT_MUSIC_DIR;
  console.log(
    `[seed-global-music] source=${musicDir}${options.force ? " force=true" : ""}`,
  );

  const entries = await readdir(musicDir, { withFileTypes: true });
  const files = entries
    .filter(
      (e) =>
        e.isFile() && AUDIO_EXT.has(path.extname(e.name).toLowerCase()),
    )
    .map((e) => e.name)
    .sort();

  if (files.length === 0) {
    throw new Error(`No audio files under ${musicDir}`);
  }
  console.log(`[seed-global-music] found ${files.length} files`);

  await seedGlobalAudioLibrary({
    label: "seed-global-music",
    force: options.force,
    items: files.map((filename) => ({
      filePath: path.join(musicDir, filename),
      s3Key: globalMusicKey(filename),
      originalFilename: filename,
    })),
    isLibraryKey: isGlobalMusicKey,
  });
}

function isDirectRun(): boolean {
  const entry = process.argv[1];
  if (!entry) return false;
  return path.resolve(entry) === fileURLToPath(import.meta.url);
}

if (isDirectRun()) {
  const { dir, force } = parseSeedDirArgs(
    process.argv.slice(2),
    DEFAULT_MUSIC_DIR,
  );
  seedGlobalMusic({ dir, force })
    .then(() => process.exit(0))
    .catch((error: unknown) => {
      console.error("[seed-global-music] failed:", error);
      process.exit(1);
    });
}
