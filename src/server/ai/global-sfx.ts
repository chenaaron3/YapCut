import { and, eq, isNull } from "drizzle-orm";

import { db } from "~/server/db";
import { assets } from "~/server/db/schema";
import { isGlobalSfxKey } from "~/server/media/keys";

import type { CompanionSfxAsset } from "~/domain/companion-sfx";

export type GlobalSfxLibrary = {
  assets: CompanionSfxAsset[];
  durationByAssetId: Map<string, number | null>;
};

export async function loadGlobalSfxAssets(): Promise<GlobalSfxLibrary> {
  const rows = await db
    .select({
      id: assets.id,
      s3Key: assets.s3Key,
      durationSec: assets.durationSec,
      originalFilename: assets.originalFilename,
    })
    .from(assets)
    .where(and(isNull(assets.projectId), eq(assets.kind, "audio")));

  const durationByAssetId = new Map<string, number | null>();
  const sfxAssets: CompanionSfxAsset[] = [];
  for (const row of rows) {
    if (!isGlobalSfxKey(row.s3Key)) continue;
    sfxAssets.push({
      id: row.id,
      originalFilename: row.originalFilename,
    });
    durationByAssetId.set(row.id, row.durationSec);
  }

  return { assets: sfxAssets, durationByAssetId };
}
