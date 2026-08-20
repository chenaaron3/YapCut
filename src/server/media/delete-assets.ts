import { eq, inArray } from "drizzle-orm";

import { assets, masks } from "~/server/db/schema";
import { deleteObject } from "~/server/media/s3";

import type { db } from "~/server/db";

type Db = typeof db;

async function deleteS3Keys(keys: readonly string[]): Promise<void> {
  for (const key of keys) {
    try {
      await deleteObject(key);
    } catch (error) {
      console.warn(
        `[assets] S3 delete failed for ${key}:`,
        error instanceof Error ? error.message : error,
      );
    }
  }
}

/**
 * Delete assets by id: mask decorator S3, asset S3, then DB rows (mask cascades).
 */
export async function deleteAssets(
  database: Db,
  assetIds: readonly string[],
): Promise<void> {
  if (assetIds.length === 0) return;

  const uniqueIds = [...new Set(assetIds)];
  const rows = await database
    .select({
      id: assets.id,
      s3Key: assets.s3Key,
      maskS3Key: masks.s3Key,
    })
    .from(assets)
    .leftJoin(masks, eq(masks.assetId, assets.id))
    .where(inArray(assets.id, uniqueIds));

  if (rows.length === 0) return;

  await deleteS3Keys(
    rows.flatMap((row) =>
      [row.s3Key, row.maskS3Key].filter(
        (key): key is string => key != null && key !== "",
      ),
    ),
  );

  await database.delete(assets).where(
    inArray(
      assets.id,
      rows.map((row) => row.id),
    ),
  );
}
