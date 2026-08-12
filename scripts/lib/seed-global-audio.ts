import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { eq, isNull } from "drizzle-orm";

import { db } from "~/server/db";
import { assets } from "~/server/db/schema";
import { invalidateCloudFrontPaths } from "~/server/media/cloudfront";
import {
  measureMediaUrl,
  probeDurationSec,
  probeMediaLoudness,
  roundLoudness,
} from "~/server/media/measure-audio";
import { deleteObject, headObject, putObject } from "~/server/media/s3";

export type SeedAudioItem = {
  filePath: string;
  s3Key: string;
  originalFilename: string;
};

type ExistingRow = {
  id: string;
  s3Key: string;
  durationSec: number | null;
  kind: string;
  originalFilename: string | null;
  lufs: number | null;
};

function contentTypeFor(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".wav") return "audio/wav";
  if (ext === ".mp3") return "audio/mpeg";
  if (ext === ".m4a") return "audio/mp4";
  if (ext === ".ogg") return "audio/ogg";
  if (ext === ".flac") return "audio/flac";
  throw new Error(`Unsupported audio extension: ${ext}`);
}

function md5Hex(body: Buffer): string {
  return createHash("md5").update(body).digest("hex");
}

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
  return head.contentLength === body.length;
}

export function parseSeedDirArgs(
  argv: string[],
  defaultDir: string,
): { dir: string; force: boolean } {
  const force = argv.includes("--force");
  const idx = argv.indexOf("--dir");
  if (idx >= 0) {
    const value = argv[idx + 1];
    if (!value) throw new Error("--dir requires a path");
    return { dir: path.resolve(value), force };
  }
  return { dir: defaultDir, force };
}

/**
 * Idempotent S3 + Asset upsert for one global audio library.
 * Prunes only rows whose key matches `isLibraryKey` and is not in the keep set.
 */
export async function seedGlobalAudioLibrary(options: {
  label: string;
  force: boolean;
  items: SeedAudioItem[];
  isLibraryKey: (s3Key: string) => boolean;
}): Promise<void> {
  const { label, force, items, isLibraryKey } = options;
  const keepS3Keys = new Set(items.map((item) => item.s3Key));

  const existing = await db
    .select({
      id: assets.id,
      s3Key: assets.s3Key,
      durationSec: assets.durationSec,
      kind: assets.kind,
      originalFilename: assets.originalFilename,
      lufs: assets.lufs,
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

  for (const item of items) {
    const { filePath, s3Key, originalFilename } = item;
    const contentType = contentTypeFor(filePath);
    const body = await readFile(filePath);

    const head = await headObject(s3Key);
    let didReupload = false;
    if (!head) {
      await putObject({ key: s3Key, body, contentType });
      uploaded += 1;
      console.log(`  upload  ${originalFilename}`);
    } else if (force || !objectMatchesLocal(head, body)) {
      await putObject({ key: s3Key, body, contentType });
      reuploaded += 1;
      didReupload = true;
      invalidateKeys.push(s3Key);
      console.log(
        `  reupload  ${originalFilename}${force ? " (--force)" : " (content changed)"}`,
      );
    } else {
      skipped += 1;
    }

    const row: ExistingRow | undefined = byKey.get(s3Key);
    let assetId = row?.id;
    const mediaUrl = measureMediaUrl(s3Key);
    const needDuration =
      !row || force || didReupload || row.durationSec == null;
    const probed = needDuration ? await probeDurationSec(mediaUrl) : 0;
    const durationSec = needDuration
      ? probed > 0
        ? probed
        : null
      : row.durationSec;

    if (!row) {
      assetId = crypto.randomUUID();
      await db.insert(assets).values({
        id: assetId,
        projectId: null,
        kind: "audio",
        s3Key,
        contentType,
        durationSec,
        originalFilename,
        sortOrder: 0,
      });
      inserted += 1;
      console.log(`  insert  ${originalFilename} → ${assetId}`);
    } else {
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
      if (row.originalFilename !== originalFilename) {
        patch.originalFilename = originalFilename;
        needsUpdate = true;
      }
      if (didReupload) needsUpdate = true;
      if (needsUpdate) {
        await db.update(assets).set(patch).where(eq(assets.id, row.id));
        updated += 1;
        console.log(`  update  ${originalFilename}`);
      }
    }

    const existingLufs = row?.lufs ?? null;
    if (force || didReupload || existingLufs == null) {
      try {
        const probe = await probeMediaLoudness(mediaUrl);
        await db
          .update(assets)
          .set({
            lufs: roundLoudness(probe.lufs, 2),
            truePeakDb: roundLoudness(probe.truePeakDb, 2),
            updatedAt: new Date(),
          })
          .where(eq(assets.id, assetId!));
        console.log(
          `  loudness  ${originalFilename} lufs=${probe.lufs.toFixed(2)} peak=${probe.truePeakDb.toFixed(2)}`,
        );
      } catch (error) {
        console.warn(
          `  loudness skip ${originalFilename}:`,
          error instanceof Error ? error.message : error,
        );
      }
    }
  }

  let pruned = 0;
  for (const row of existing) {
    if (row.kind !== "audio") continue;
    if (!isLibraryKey(row.s3Key)) continue;
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
    `[${label}] done uploaded=${uploaded} reuploaded=${reuploaded} s3Skipped=${skipped} inserted=${inserted} updated=${updated} pruned=${pruned}`,
  );
}
