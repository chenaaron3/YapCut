/**
 * Upload the prototype SFX pack to S3 and insert global Asset rows
 * (`projectId = null`). Idempotent on `s3Key`.
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

import { AI_SFX_PACK } from "~/domain/ai-sfx-pack";
import { db } from "~/server/db";
import { assets } from "~/server/db/schema";
import { globalSfxKey } from "~/server/media/keys";
import { headObject, putObject } from "~/server/media/s3";

const execFileAsync = promisify(execFile);

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_SFX_DIR = path.resolve(
  ROOT,
  "../talking-head/public/sfx",
);

const AUDIO_EXT = new Set([".wav", ".mp3"]);

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

async function main() {
  const sfxDir = parseDirArg(process.argv.slice(2));
  console.log(`[seed-global-sfx] source=${sfxDir}`);

  const files = await walkAudioFiles(sfxDir);
  if (files.length === 0) {
    throw new Error(`No .wav/.mp3 files under ${sfxDir}`);
  }
  console.log(`[seed-global-sfx] found ${files.length} files`);

  const existing = await db
    .select({
      id: assets.id,
      s3Key: assets.s3Key,
      durationSec: assets.durationSec,
    })
    .from(assets)
    .where(isNull(assets.projectId));
  const byKey = new Map(existing.map((a) => [a.s3Key, a]));

  let uploaded = 0;
  let skipped = 0;
  let inserted = 0;
  let updated = 0;

  for (const filePath of files) {
    const relativePath = path.relative(sfxDir, filePath).split(path.sep).join("/");
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

    if (row.durationSec == null && durationSec != null) {
      await db
        .update(assets)
        .set({ durationSec, updatedAt: new Date() })
        .where(eq(assets.id, row.id));
      updated += 1;
      console.log(`  update  ${relativePath} duration=${durationSec.toFixed(3)}s`);
    }
  }

  const globalIds = new Set(
    (
      await db
        .select({ id: assets.id })
        .from(assets)
        .where(isNull(assets.projectId))
    ).map((r) => r.id),
  );
  const missingPack = AI_SFX_PACK.filter((v) => !globalIds.has(v.assetId));
  if (missingPack.length) {
    console.warn(
      `[seed-global-sfx] AI SFX pack missing ${missingPack.length} asset id(s):`,
    );
    for (const v of missingPack) {
      console.warn(`  - ${v.id} → ${v.assetId}`);
    }
  } else {
    console.log(
      `[seed-global-sfx] AI SFX pack ok (${AI_SFX_PACK.length} variants)`,
    );
  }

  console.log(
    `[seed-global-sfx] done uploaded=${uploaded} s3Skipped=${skipped} inserted=${inserted} updated=${updated}`,
  );
  process.exit(0);
}

main().catch((error: unknown) => {
  console.error("[seed-global-sfx] failed:", error);
  process.exit(1);
});
