/**
 * Upload public/sfx to S3 and insert global Asset rows (`projectId` null).
 * Idempotent on `s3Key`. Re-uploads when local bytes differ (size/MD5) or `--force`.
 * Invalidates CloudFront for overwritten keys when `CLOUDFRONT_DISTRIBUTION_ID` is set.
 * Prunes obsolete global audio not in the keep set.
 *
 * Layout:
 *   public/sfx/<role>/*               — AI companion pools (flat per role)
 *   public/sfx/custom/<folder>/*      — manual library only (memes, riser, …)
 *
 * Usage:
 *   npm run seed:global-sfx
 *   npm run seed:global-sfx -- --force
 *   npm run seed:global-sfx -- --dir /path/to/public/sfx
 */
import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import { eq, isNull } from "drizzle-orm";

import {
  AI_SFX_ROLES,
  expectedAiSfxPoolDirs,
  parseAiSfxPoolPath,
} from "~/domain/ai-sfx-pack";
import { db } from "~/server/db";
import { assets } from "~/server/db/schema";
import { invalidateCloudFrontPaths } from "~/server/media/cloudfront";
import { globalSfxKey } from "~/server/media/keys";
import { deleteObject, headObject, putObject } from "~/server/media/s3";

const execFileAsync = promisify(execFile);

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_SFX_DIR = path.resolve(ROOT, "public/sfx");

const AUDIO_EXT = new Set([".wav", ".mp3"]);
const CUSTOM_PREFIX = "custom/";

function contentTypeFor(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".wav") return "audio/wav";
  if (ext === ".mp3") return "audio/mpeg";
  throw new Error(`Unsupported audio extension: ${ext}`);
}

function md5Hex(body: Buffer): string {
  return createHash("md5").update(body).digest("hex");
}

/** Strip quotes from S3 ETag; multipart ETags contain `-` and are not plain MD5. */
function normalizeEtag(etag: string | undefined): string | null {
  if (!etag) return null;
  const bare = etag.replaceAll('"', "");
  if (bare.includes("-")) return null;
  return bare.toLowerCase();
}

function objectMatchesLocal(
  head: { contentLength?: number; etag?: string },
  body: Buffer,
): boolean {
  if (head.contentLength != null && head.contentLength !== body.length) {
    return false;
  }
  const remoteMd5 = normalizeEtag(head.etag);
  if (remoteMd5 != null && remoteMd5 !== md5Hex(body)) {
    return false;
  }
  // Same size and (matching MD5 or multipart/unknown etag) → treat as current.
  return head.contentLength === body.length;
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

function parseArgs(argv: string[]): { sfxDir: string; force: boolean } {
  const force = argv.includes("--force");
  const idx = argv.indexOf("--dir");
  if (idx >= 0) {
    const value = argv[idx + 1];
    if (!value) throw new Error("--dir requires a path");
    return { sfxDir: path.resolve(value), force };
  }
  return { sfxDir: DEFAULT_SFX_DIR, force };
}

function isKeepRelativePath(relativePath: string): boolean {
  if (relativePath.startsWith(CUSTOM_PREFIX)) return true;
  return parseAiSfxPoolPath(relativePath) != null;
}

async function main() {
  const { sfxDir, force } = parseArgs(process.argv.slice(2));
  console.log(
    `[seed-global-sfx] source=${sfxDir}${force ? " force=true" : ""}`,
  );

  const files = await walkAudioFiles(sfxDir);
  if (files.length === 0) {
    throw new Error(`No .wav/.mp3 files under ${sfxDir}`);
  }
  console.log(`[seed-global-sfx] found ${files.length} files`);

  // Validate every AI role pool has ≥1 file.
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
  let reuploaded = 0;
  let skipped = 0;
  let inserted = 0;
  let updated = 0;
  const invalidateKeys: string[] = [];

  for (const relativePath of [...keepRelative].sort()) {
    const filePath = path.join(sfxDir, ...relativePath.split("/"));
    const s3Key = globalSfxKey(relativePath);
    const contentType = contentTypeFor(filePath);
    const durationSec = await probeDurationSec(filePath);
    const body = await readFile(filePath);

    const head = await headObject(s3Key);
    let didReupload = false;
    if (!head) {
      await putObject({ key: s3Key, body, contentType });
      uploaded += 1;
      console.log(`  upload  ${relativePath}`);
    } else if (force || !objectMatchesLocal(head, body)) {
      await putObject({ key: s3Key, body, contentType });
      reuploaded += 1;
      didReupload = true;
      invalidateKeys.push(s3Key);
      console.log(
        `  reupload  ${relativePath}${force ? " (--force)" : " (content changed)"}`,
      );
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
    // Bump updatedAt when bytes were overwritten even if duration unchanged.
    if (didReupload) {
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

  if (invalidateKeys.length > 0) {
    try {
      const result = await invalidateCloudFrontPaths(invalidateKeys);
      if (result) {
        console.log(
          `  invalidate  CloudFront ${result.id} (${result.paths.length} paths)`,
        );
      } else {
        console.warn(
          `  invalidate  skipped — set CLOUDFRONT_DISTRIBUTION_ID to bust CDN cache after reupload.\n` +
            `    aws cloudfront create-invalidation --distribution-id <id> --paths ${invalidateKeys
              .map((k) => `/${k}`)
              .join(" ")}`,
        );
      }
    } catch (error) {
      console.warn(
        `  invalidate  failed: ${error instanceof Error ? error.message : error}\n` +
          `    Ensure AppMediaPolicy includes cloudfront:CreateInvalidation, or run:\n` +
          `    aws cloudfront create-invalidation --distribution-id <id> --paths ${invalidateKeys
            .map((k) => `/${k}`)
            .join(" ")}`,
      );
    }
  }

  console.log(
    `[seed-global-sfx] done uploaded=${uploaded} reuploaded=${reuploaded} s3Skipped=${skipped} inserted=${inserted} updated=${updated} pruned=${pruned}`,
  );
  process.exit(0);
}

main().catch((error: unknown) => {
  console.error("[seed-global-sfx] failed:", error);
  process.exit(1);
});
