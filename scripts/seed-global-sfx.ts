/**
 * Upload public/sfx to S3 and insert global Asset rows (`projectId` null).
 * Idempotent on `s3Key`. Re-uploads when local bytes differ (size/MD5) or `--force`.
 * Invalidates CloudFront for overwritten keys when `CLOUDFRONT_DISTRIBUTION_ID` is set.
 * Prunes obsolete global SFX keys not in the keep set (never music).
 *
 * Layout:
 *   public/sfx/<role>/*               — AI companion pools (flat per role)
 *   public/sfx/custom/<folder>/*      — manual library only (memes, riser, …)
 *
 * Usage:
 *   npm run seed:global
 *   npm run seed:global-sfx
 *   npm run seed:global-sfx -- --force
 *   npm run seed:global-sfx -- --dir /path/to/public/sfx
 */
import { readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  AI_SFX_ROLES,
  expectedAiSfxPoolDirs,
  parseAiSfxPoolPath,
} from "~/domain/ai-sfx-pack";
import { globalSfxKey, isGlobalSfxKey } from "~/server/media/keys";
import {
  parseSeedDirArgs,
  seedGlobalAudioLibrary,
} from "./lib/seed-global-audio";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_SFX_DIR = path.resolve(ROOT, "public/sfx");
const AUDIO_EXT = new Set([".wav", ".mp3"]);
const CUSTOM_PREFIX = "custom/";

async function walkAudioFiles(dir: string): Promise<string[]> {
  const out: string[] = [];
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...(await walkAudioFiles(full)));
      continue;
    }
    if (entry.isFile() && AUDIO_EXT.has(path.extname(entry.name).toLowerCase())) {
      out.push(full);
    }
  }
  return out.sort();
}

function isKeepRelativePath(relativePath: string): boolean {
  if (relativePath.startsWith(CUSTOM_PREFIX)) return true;
  return parseAiSfxPoolPath(relativePath) != null;
}

export async function seedGlobalSfx(options: {
  dir?: string;
  force: boolean;
}): Promise<void> {
  const sfxDir = options.dir ?? DEFAULT_SFX_DIR;
  console.log(
    `[seed-global-sfx] source=${sfxDir}${options.force ? " force=true" : ""}`,
  );

  const files = await walkAudioFiles(sfxDir);
  if (files.length === 0) {
    throw new Error(`No .wav/.mp3 files under ${sfxDir}`);
  }
  console.log(`[seed-global-sfx] found ${files.length} files`);

  const poolCounts = new Map<string, number>();
  for (const dir of expectedAiSfxPoolDirs()) {
    poolCounts.set(dir, 0);
  }
  const customCounts = new Map<string, number>();

  for (const filePath of files) {
    const relativePath = path.relative(sfxDir, filePath).split(path.sep).join("/");
    if (relativePath.startsWith(CUSTOM_PREFIX)) {
      const folder = relativePath.split("/")[1] ?? "custom";
      customCounts.set(folder, (customCounts.get(folder) ?? 0) + 1);
      continue;
    }
    const parsed = parseAiSfxPoolPath(relativePath);
    if (!parsed) {
      console.warn(
        `[seed-global-sfx] skipping non-pack path (won't keep): ${relativePath}`,
      );
      continue;
    }
    poolCounts.set(parsed.role, (poolCounts.get(parsed.role) ?? 0) + 1);
  }

  const emptyPools = [...poolCounts.entries()].filter(([, n]) => n === 0);
  if (emptyPools.length > 0) {
    throw new Error(
      `Empty AI SFX pools (need ≥1 file each):\n${emptyPools
        .map(([d]) => `  - ${d}/`)
        .join("\n")}`,
    );
  }

  for (const role of AI_SFX_ROLES) {
    console.log(`  pool  ${role}: ${poolCounts.get(role) ?? 0}`);
  }
  for (const [folder, n] of [...customCounts.entries()].sort()) {
    console.log(`  pool  custom/${folder}: ${n}`);
  }

  const keepRelative = new Set<string>();
  for (const filePath of files) {
    const relativePath = path.relative(sfxDir, filePath).split(path.sep).join("/");
    if (isKeepRelativePath(relativePath)) {
      keepRelative.add(relativePath);
    }
  }

  await seedGlobalAudioLibrary({
    label: "seed-global-sfx",
    force: options.force,
    items: [...keepRelative].sort().map((relativePath) => ({
      filePath: path.join(sfxDir, ...relativePath.split("/")),
      s3Key: globalSfxKey(relativePath),
      originalFilename: relativePath,
    })),
    isLibraryKey: isGlobalSfxKey,
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
    DEFAULT_SFX_DIR,
  );
  seedGlobalSfx({ dir, force }).catch((error: unknown) => {
    console.error("[seed-global-sfx] failed:", error);
    process.exit(1);
  });
}
