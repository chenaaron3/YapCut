/**
 * Upload public/sfx to S3 and insert global Asset rows (`projectId` null).
 * Idempotent on `s3Key`. Prunes obsolete global audio not in the keep set.
 *
 * Layout:
 *   public/sfx/<role>/<intensity>/*   — AI companion pools
 *   public/sfx/custom/memes/*         — manual library only
 *
 * Usage:
 *   npm run seed:global-sfx
 *   npm run seed:global-sfx -- --dir /path/to/public/sfx
 */
import { execFile } from "node:child_process";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import { eq, isNull } from "drizzle-orm";

import {
  AI_SFX_INTENSITIES,
  AI_SFX_ROLES,
  expectedAiSfxPoolDirs,
  parseAiSfxPoolPath,
} from "~/domain/ai-sfx-pack";
import { db } from "~/server/db";
import { assets } from "~/server/db/schema";
import { globalSfxKey } from "~/server/media/keys";
import { deleteObject, headObject, putObject } from "~/server/media/s3";

const execFileAsync = promisify(execFile);

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_SFX_DIR = path.resolve(ROOT, "public/sfx");

const AUDIO_EXT = new Set([".wav", ".mp3"]);
const MEME_PREFIX = "custom/memes/";

function contentTypeFor(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".wav") return "audio/wav";
  if (ext === ".mp3") return "audio/mpeg";
  throw new Error(`Unsupported audio extension: ${ext}`);
}

async function probeDurationSec(filePath: string): Promise<number | null> {
  try {
    const { stdout } = await execFileAsync(
      "ffprobe",
      [
        "-v",
        "error",
        "-show_entries",
        "format=duration",
        "-of",
        "default=noprint_wrappers=1:nokey=1",
        filePath,
      ],
      { timeout: 30_000 },
    );
    const n = Number.parseFloat(stdout.trim());
    return Number.isFinite(n) && n > 0 ? n : null;
  } catch {
    return null;
  }
}

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

function parseDirArg(argv: string[]): string {
  const idx = argv.indexOf("--dir");
  if (idx >= 0) {
    const value = argv[idx + 1];
    if (!value) throw new Error("--dir requires a path");
    return path.resolve(value);
  }
  return DEFAULT_SFX_DIR;
}

function isKeepRelativePath(relativePath: string): boolean {
  if (relativePath.startsWith(MEME_PREFIX)) return true;
  return parseAiSfxPoolPath(relativePath) != null;
}

async function main() {
  const sfxDir = parseDirArg(process.argv.slice(2));
  console.log(`[seed-global-sfx] source=${sfxDir}`);

  const files = await walkAudioFiles(sfxDir);
  if (files.length === 0) {
    throw new Error(`No .wav/.mp3 files under ${sfxDir}`);
  }
  console.log(`[seed-global-sfx] found ${files.length} files`);

  // Validate every AI role/intensity pool has ≥1 file.
  const poolCounts = new Map<string, number>();
  for (const dir of expectedAiSfxPoolDirs()) {
    poolCounts.set(dir, 0);
  }
  let memeCount = 0;

  for (const filePath of files) {
    const relativePath = path.relative(sfxDir, filePath).split(path.sep).join("/");
    if (relativePath.startsWith(MEME_PREFIX)) {
      memeCount += 1;
      continue;
    }
    const parsed = parseAiSfxPoolPath(relativePath);
    if (!parsed) {
      console.warn(
        `[seed-global-sfx] skipping non-pack path (won't keep): ${relativePath}`,
      );
      continue;
    }
    const key = `${parsed.role}/${parsed.intensity}`;
    poolCounts.set(key, (poolCounts.get(key) ?? 0) + 1);
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
    for (const intensity of AI_SFX_INTENSITIES) {
      const key = `${role}/${intensity}`;
      console.log(`  pool  ${key}: ${poolCounts.get(key) ?? 0}`);
    }
  }
  console.log(`  pool  custom/memes: ${memeCount}`);

  const keepRelative = new Set<string>();
  for (const filePath of files) {
    const relativePath = path.relative(sfxDir, filePath).split(path.sep).join("/");
    if (isKeepRelativePath(relativePath)) {
      keepRelative.add(relativePath);
    }
  }
  const keepS3Keys = new Set([...keepRelative].map((r) => globalSfxKey(r)));

  const existing = await db
    .select({
      id: assets.id,
      s3Key: assets.s3Key,
      durationSec: assets.durationSec,
      kind: assets.kind,
      originalFilename: assets.originalFilename,
    })
    .from(assets)
    .where(isNull(assets.projectId));
  const byKey = new Map(existing.map((a) => [a.s3Key, a]));

  let uploaded = 0;
  let skipped = 0;
  let inserted = 0;
  let updated = 0;

  for (const relativePath of [...keepRelative].sort()) {
    const filePath = path.join(sfxDir, ...relativePath.split("/"));
    const s3Key = globalSfxKey(relativePath);
    const contentType = contentTypeFor(filePath);
    const durationSec = await probeDurationSec(filePath);
    const body = await readFile(filePath);

    const head = await headObject(s3Key);
    if (!head) {
      await putObject({ key: s3Key, body, contentType });
      uploaded += 1;
      console.log(`  upload  ${relativePath}`);
    } else {
      skipped += 1;
    }

    const row = byKey.get(s3Key);
    if (!row) {
      const assetId = crypto.randomUUID();
      await db.insert(assets).values({
        id: assetId,
        projectId: null,
        kind: "audio",
        s3Key,
        contentType,
        durationSec,
        originalFilename: relativePath,
        sortOrder: 0,
      });
      inserted += 1;
      console.log(`  insert  ${relativePath} → ${assetId}`);
      continue;
    }

    const patch: {
      durationSec?: number | null;
      originalFilename?: string;
      updatedAt: Date;
    } = { updatedAt: new Date() };
    let needsUpdate = false;
    if (durationSec != null && row.durationSec !== durationSec) {
      patch.durationSec = durationSec;
      needsUpdate = true;
    }
    if (row.originalFilename !== relativePath) {
      patch.originalFilename = relativePath;
      needsUpdate = true;
    }
    if (needsUpdate) {
      await db.update(assets).set(patch).where(eq(assets.id, row.id));
      updated += 1;
      console.log(`  update  ${relativePath}`);
    }
  }

  // Prune obsolete global audio (old beep-bop/, etc.).
  let pruned = 0;
  for (const row of existing) {
    if (row.kind !== "audio") continue;
    if (keepS3Keys.has(row.s3Key)) continue;
    await db.delete(assets).where(eq(assets.id, row.id));
    try {
      await deleteObject(row.s3Key);
    } catch (error) {
      console.warn(
        `  prune S3 warn ${row.s3Key}:`,
        error instanceof Error ? error.message : error,
      );
    }
    pruned += 1;
    console.log(`  prune  ${row.s3Key} (${row.id})`);
  }

  console.log(
    `[seed-global-sfx] done uploaded=${uploaded} s3Skipped=${skipped} inserted=${inserted} updated=${updated} pruned=${pruned}`,
  );
  process.exit(0);
}

main().catch((error: unknown) => {
  console.error("[seed-global-sfx] failed:", error);
  process.exit(1);
});
