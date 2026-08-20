import { eq } from "drizzle-orm";

import { arollAssetOrder } from "~/domain/aroll/arolls";
import { parseProjectConfig } from "~/domain/project/project-config";
import { assets, masks } from "~/server/db/schema";
import { assetMaskKey } from "~/server/media/keys";
import {
  measureMediaUrl,
  pollFalJob,
  resultFalJob,
  submitFalJob,
  type FalJobRef,
} from "~/server/media/measure-audio";
import { putObject } from "~/server/media/s3";

import {
  maskProgressEvent,
  type MaskProgressEvent,
} from "~/domain/asset/mask-progress";

import type { MaskType } from "~/domain/asset/mask";
import type { db } from "~/server/db";

type Db = typeof db;

const VIDEO_ENDPOINT = "fal-ai/birefnet/v2/video";
const IMAGE_ENDPOINT = "fal-ai/birefnet/v2";

type FalFile = {
  url?: string;
  content_type?: string;
  file_name?: string;
  width?: number;
  height?: number;
  duration?: number;
};

type BirefnetVideoResult = {
  mask_video?: FalFile;
};

type BirefnetImageResult = {
  mask_image?: FalFile;
};

/** Serializable ref for the mask Job / workflow. */
export type MaskAssetRef = {
  id: string;
  projectId: string;
  s3Key: string;
  kind: "video" | "image";
  originalFilename: string | null;
  durationSec: number | null;
  width: number | null;
  height: number | null;
};

export type MaskJobHandle = {
  job: FalJobRef;
  startedAtMs: number;
  kind: "video" | "image";
};

async function fetchBytes(
  url: string,
): Promise<{ bytes: Buffer; contentType: string }> {
  const res = await fetch(url, {
    headers: { "User-Agent": "talking-head-2-mask/1.0" },
  });
  if (!res.ok) throw new Error(`Mask fetch failed ${res.status}`);
  const contentType = res.headers.get("content-type") ?? "application/octet-stream";
  return {
    bytes: Buffer.from(await res.arrayBuffer()),
    contentType: contentType.split(";")[0]!.trim(),
  };
}

async function emitMaskProgress(
  assetId: string,
  event: MaskProgressEvent,
): Promise<void> {
  const { publishMaskProgress } = await import(
    "~/server/workflow/mask/publish"
  );
  await publishMaskProgress(assetId, event);
}

function fileUrl(file: FalFile | undefined, what: string): string {
  const url = file?.url;
  if (!url) throw new Error(`BiRefNet returned no ${what}`);
  return url;
}

function birefnetSpec(row: MaskAssetRef): {
  endpoint: string;
  input: Record<string, unknown>;
  what: string;
} {
  const mediaUrl = measureMediaUrl(row.s3Key);
  if (row.kind === "video") {
    return {
      endpoint: VIDEO_ENDPOINT,
      input: {
        video_url: mediaUrl,
        model: "Matting",
        output_mask: true,
        video_output_type: "X264 (.mp4)",
      },
      what: "mask-video",
    };
  }
  return {
    endpoint: IMAGE_ENDPOINT,
    input: {
      image_url: mediaUrl,
      model: "Matting",
      output_mask: true,
    },
    what: "mask-image",
  };
}

export async function loadMaskAssetRef(
  database: Db,
  projectId: string,
  assetId: string,
): Promise<MaskAssetRef | null> {
  const [row] = await database
    .select({
      id: assets.id,
      projectId: assets.projectId,
      kind: assets.kind,
      s3Key: assets.s3Key,
      durationSec: assets.durationSec,
      width: assets.width,
      height: assets.height,
      originalFilename: assets.originalFilename,
    })
    .from(assets)
    .where(eq(assets.id, assetId))
    .limit(1);
  if (!row || row.projectId !== projectId) return null;
  if (row.kind !== "image" && row.kind !== "video") return null;

  return {
    id: row.id,
    projectId,
    s3Key: row.s3Key,
    kind: row.kind,
    originalFilename: row.originalFilename,
    durationSec: row.durationSec,
    width: row.width,
    height: row.height,
  };
}

/** Enqueue BiRefNet. Returns null when a mask already exists. */
export async function startMaskJob(
  database: Db,
  asset: MaskAssetRef,
): Promise<MaskJobHandle | null> {
  const [fresh] = await database
    .select({ s3Key: masks.s3Key })
    .from(masks)
    .where(eq(masks.assetId, asset.id))
    .limit(1);
  if (fresh?.s3Key) {
    await emitMaskProgress(
      asset.id,
      maskProgressEvent("ready", 1),
    );
    return null;
  }
  const spec = birefnetSpec(asset);
  const job = await submitFalJob(spec.endpoint, spec.input, spec.what);
  return { job, startedAtMs: Date.now(), kind: asset.kind };
}

export async function pollMaskJob(
  handle: MaskJobHandle,
): Promise<{ done: boolean; status: Awaited<ReturnType<typeof pollFalJob>> }> {
  const status = await pollFalJob(handle.job);
  console.log(
    `[mask] poll asset request=${handle.job.requestId} status=${status}`,
  );
  return { done: status === "COMPLETED", status };
}

export async function persistMaskJob(
  database: Db,
  asset: MaskAssetRef,
  handle: MaskJobHandle,
): Promise<string> {
  const [fresh] = await database
    .select({ s3Key: masks.s3Key })
    .from(masks)
    .where(eq(masks.assetId, asset.id))
    .limit(1);
  if (fresh?.s3Key) {
    await emitMaskProgress(
      asset.id,
      maskProgressEvent("ready", 1),
    );
    return fresh.s3Key;
  }

  const mask =
    asset.kind === "video"
      ? await persistVideoMask(asset, handle)
      : await persistImageMask(asset, handle);

  const s3Key = assetMaskKey(asset.projectId, asset.id);

  await putObject({
    key: s3Key,
    body: mask.bytes,
    contentType: mask.contentType,
  });
  await database
    .update(masks)
    .set({
      s3Key,
      kind: mask.kind,
      contentType: mask.contentType,
      width: mask.width,
      height: mask.height,
      durationSec: mask.durationSec,
      runId: null,
    })
    .where(eq(masks.assetId, asset.id));
  await emitMaskProgress(
    asset.id,
    maskProgressEvent("ready", 1),
  );
  return s3Key;
}

async function persistVideoMask(asset: MaskAssetRef, handle: MaskJobHandle) {
  const data = await resultFalJob<BirefnetVideoResult>(handle.job);
  const file = data.mask_video;
  const fetched = await fetchBytes(fileUrl(file, "mask_video"));
  return {
    bytes: fetched.bytes,
    contentType: file?.content_type ?? fetched.contentType,
    kind: "video" as const,
    width: file?.width ?? asset.width,
    height: file?.height ?? asset.height,
    durationSec:
      typeof file?.duration === "number" && file.duration > 0
        ? file.duration
        : asset.durationSec,
  };
}

async function persistImageMask(asset: MaskAssetRef, handle: MaskJobHandle) {
  const data = await resultFalJob<BirefnetImageResult>(handle.job);
  const file = data.mask_image;
  const fetched = await fetchBytes(fileUrl(file, "mask_image"));
  return {
    bytes: fetched.bytes,
    contentType: file?.content_type ?? fetched.contentType,
    kind: "image" as const,
    width: file?.width ?? asset.width,
    height: file?.height ?? asset.height,
    durationSec: null,
  };
}

/** Clear Mask when the job fails and no file was stored. */
export async function failMaskJob(
  database: Db,
  asset: MaskAssetRef,
  reason: string,
): Promise<void> {
  console.warn(
    `[mask] failed asset=${asset.id}: ${reason}`,
  );
  const [fresh] = await database
    .select({ s3Key: masks.s3Key })
    .from(masks)
    .where(eq(masks.assetId, asset.id))
    .limit(1);
  if (fresh?.s3Key) {
    await emitMaskProgress(
      asset.id,
      maskProgressEvent("ready", 1),
    );
    return;
  }
  await database.delete(masks).where(eq(masks.assetId, asset.id));
  await emitMaskProgress(
    asset.id,
    maskProgressEvent("failed", 0, reason),
  );
}

export function assertMaskAllowed(options: {
  type: MaskType | null;
  source: { id: string; kind: "video" | "image" | "audio" };
  config: unknown;
}): void {
  if (options.source.kind !== "image" && options.source.kind !== "video") {
    throw new Error("Mask is only available for image and video");
  }
  if (options.type == null) return;
  const config = parseProjectConfig(options.config);
  const isAroll = arollAssetOrder(config.arolls).includes(options.source.id);
  if (options.type === "cutout") {
    if (isAroll) {
      throw new Error("Remove background is only available on B-roll");
    }
    return;
  }
  if (!isAroll) {
    throw new Error("Separate background is only available on A-roll");
  }
}

