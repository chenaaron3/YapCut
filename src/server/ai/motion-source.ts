import { stillMediaRef } from "~/domain/vfx/motion-config";
import { generateImage } from "~/server/ai/images/generate";
import { searchImage } from "~/server/ai/images/search";
import { assets } from "~/server/db/schema";
import { signedCloudFrontUrl } from "~/server/media/cloudfront";
import { assetSourceKey } from "~/server/media/keys";
import { nextAssetSortOrder } from "~/server/media/asset-upload";
import { putObject } from "~/server/media/s3";

import type { MediaRef } from "~/domain/project/project-config";
import type { ImageSize, RemoteStill } from "~/server/ai/images/types";

type Database = Parameters<typeof nextAssetSortOrder>[0];

export type AssetNeed = {
  query?: string | null;
  method: "search" | "generate";
  imageSize?: ImageSize | null;
};

export type SourcedAsset = {
  ref: MediaRef;
  client: {
    id: string;
    kind: "image";
    playbackUrl: string;
    durationSec: null;
    width: number | null;
    height: number | null;
    originalFilename: string | null;
    sortOrder: number;
    audioLibrary: null;
    lufs: null;
    truePeakDb: null;
    waveform: null;
  };
};

function sizeFromImageBytes(
  bytes: Buffer,
): { width: number; height: number } | null {
  if (bytes.length >= 24 && bytes[0] === 0x89 && bytes[1] === 0x50) {
    return {
      width: bytes.readUInt32BE(16),
      height: bytes.readUInt32BE(20),
    };
  }
  if (bytes.length > 4 && bytes[0] === 0xff && bytes[1] === 0xd8) {
    let offset = 2;
    while (offset + 8 < bytes.length) {
      if (bytes[offset] !== 0xff) break;
      const marker = bytes[offset + 1]!;
      const length = bytes.readUInt16BE(offset + 2);
      if (marker >= 0xc0 && marker <= 0xc2) {
        return {
          height: bytes.readUInt16BE(offset + 5),
          width: bytes.readUInt16BE(offset + 7),
        };
      }
      offset += 2 + length;
    }
  }
  return null;
}

async function fetchBytes(url: string): Promise<{ bytes: Buffer; contentType: string }> {
  const res = await fetch(url, {
    headers: { "User-Agent": "talking-head-2-motion/1.0" },
  });
  if (!res.ok) throw new Error(`Fetch failed ${res.status} for ${url}`);
  const contentType = res.headers.get("content-type") ?? "image/jpeg";
  const bytes = Buffer.from(await res.arrayBuffer());
  return { bytes, contentType: contentType.split(";")[0]!.trim() };
}

async function persistImage(options: {
  db: Database;
  projectId: string;
  still: RemoteStill;
}): Promise<SourcedAsset> {
  const fetched = await fetchBytes(options.still.url);
  const probed = sizeFromImageBytes(fetched.bytes);
  const width = probed?.width ?? options.still.width;
  const height = probed?.height ?? options.still.height;
  const assetId = crypto.randomUUID();
  const s3Key = assetSourceKey(options.projectId, assetId);
  const sortOrder = await nextAssetSortOrder(options.db, options.projectId);
  await putObject({
    key: s3Key,
    body: fetched.bytes,
    contentType: fetched.contentType,
  });
  await options.db.insert(assets).values({
    id: assetId,
    projectId: options.projectId,
    kind: "image",
    s3Key,
    contentType: fetched.contentType,
    originalFilename: "still.png",
    sortOrder,
    width,
    height,
  });
  return {
    ref: stillMediaRef(assetId),
    client: {
      id: assetId,
      kind: "image",
      playbackUrl: signedCloudFrontUrl(s3Key, { expiresInSec: 60 * 60 * 6 }),
      durationSec: null,
      width,
      height,
      originalFilename: "still.png",
      sortOrder,
      audioLibrary: null,
      lufs: null,
      truePeakDb: null,
      waveform: null,
    },
  };
}

export async function sourceMotionAssets(options: {
  db: Database;
  projectId: string;
  needs: readonly AssetNeed[];
}): Promise<SourcedAsset[]> {
  const out: SourcedAsset[] = [];
  for (const need of options.needs) {
    const prompt = need.query?.trim() || "still";
    const imageSize = need.imageSize ?? "portrait";
    console.log(
      `[motion] ${need.method} size=${imageSize} query=${JSON.stringify(prompt)}`,
    );
    const still =
      need.method === "search"
        ? await searchImage({ prompt, imageSize })
        : await generateImage({ prompt, imageSize });
    out.push(
      await persistImage({
        db: options.db,
        projectId: options.projectId,
        still,
      }),
    );
  }
  return out;
}
