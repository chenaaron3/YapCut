import { desc, eq } from "drizzle-orm";

import { db } from "~/server/db";
import { assets, type AssetKind } from "~/server/db/schema";
import { assetSourceKey } from "~/server/media/keys";
import { headObject, presignPutObject } from "~/server/media/s3";

type Db = typeof db;

export type PresignedAssetUpload = {
  assetId: string;
  s3Key: string;
  uploadUrl: string;
  contentType: string;
};

export type AssetUploadInsert = {
  filename: string;
  contentType: string;
  kind: AssetKind;
  sortOrder: number;
  width?: number | null;
  height?: number | null;
  durationSec?: number | null;
};

/** Next `sortOrder` for a new asset on the project (0 if none). */
export async function nextAssetSortOrder(
  database: Db,
  projectId: string,
): Promise<number> {
  const existing = await database
    .select({ sortOrder: assets.sortOrder })
    .from(assets)
    .where(eq(assets.projectId, projectId))
    .orderBy(desc(assets.sortOrder))
    .limit(1);
  return (existing[0]?.sortOrder ?? -1) + 1;
}

/** Insert asset rows and return presigned PUT targets for client upload. */
export async function insertAssetsAndPresign(options: {
  db: Db;
  projectId: string;
  files: AssetUploadInsert[];
}): Promise<PresignedAssetUpload[]> {
  const uploads: PresignedAssetUpload[] = [];

  for (const file of options.files) {
    const assetId = crypto.randomUUID();
    const s3Key = assetSourceKey(options.projectId, assetId);

    await options.db.insert(assets).values({
      id: assetId,
      projectId: options.projectId,
      kind: file.kind,
      s3Key,
      contentType: file.contentType,
      originalFilename: file.filename,
      sortOrder: file.sortOrder,
      width: file.width ?? null,
      height: file.height ?? null,
      durationSec: file.durationSec ?? null,
    });

    const uploadUrl = await presignPutObject({
      key: s3Key,
      contentType: file.contentType,
    });

    uploads.push({
      assetId,
      s3Key,
      uploadUrl,
      contentType: file.contentType,
    });
  }

  return uploads;
}

/** Verify each asset’s S3 object exists after client PUT. Throws on failure. */
export async function assertAssetsUploaded(
  rows: Array<{
    id: string;
    s3Key: string;
    originalFilename: string | null;
  }>,
): Promise<void> {
  for (const asset of rows) {
    let head;
    try {
      head = await headObject(asset.s3Key);
    } catch (error) {
      throw new Error(
        error instanceof Error
          ? error.message
          : "Could not verify upload in S3",
      );
    }
    if (!head) {
      throw new Error(
        `Upload missing for ${asset.originalFilename ?? asset.id} (nothing at s3://${asset.s3Key})`,
      );
    }
  }
}
