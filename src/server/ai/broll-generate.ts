import { and, eq } from "drizzle-orm";

import { isEditorProjectStatus } from "~/domain/project/project-status";
import { generateBrollStills } from "~/server/ai/images/generate";
import {
  isAllowedGeneratedStillUrl,
  persistImage,
} from "~/server/ai/images/persist";
import { db } from "~/server/db";
import { assets, projects } from "~/server/db/schema";
import { signedCloudFrontUrl } from "~/server/media/cloudfront";

import type { GeneratedAsset } from "~/server/ai/images/persist";
import type { ImageSize, RemoteStill } from "~/server/ai/images/types";

async function requireEditorProject(options: {
  projectId: string;
  userId: string;
}) {
  const [project] = await db
    .select({
      id: projects.id,
      status: projects.status,
    })
    .from(projects)
    .where(
      and(
        eq(projects.id, options.projectId),
        eq(projects.userId, options.userId),
      ),
    )
    .limit(1);

  if (!project) throw new Error("Project not found");
  if (!isEditorProjectStatus(project.status)) {
    throw new Error(`Cannot generate while status is ${project.status}`);
  }
  return project;
}

async function signedReferenceUrl(options: {
  projectId: string;
  assetId: string;
}): Promise<string> {
  const [asset] = await db
    .select({
      id: assets.id,
      kind: assets.kind,
      s3Key: assets.s3Key,
    })
    .from(assets)
    .where(
      and(
        eq(assets.id, options.assetId),
        eq(assets.projectId, options.projectId),
      ),
    )
    .limit(1);

  if (!asset) throw new Error("Reference image not found");
  if (asset.kind !== "image") {
    throw new Error("Reference must be an image from B-roll");
  }
  return signedCloudFrontUrl(asset.s3Key, { expiresInSec: 60 * 60 * 6 });
}

export async function generateBrollCandidates(input: {
  projectId: string;
  userId: string;
  prompt: string;
  imageSize: ImageSize;
  referenceAssetId?: string | null;
}): Promise<{ candidates: RemoteStill[] }> {
  const prompt = input.prompt.trim();
  if (!prompt) throw new Error("Prompt is empty");
  await requireEditorProject(input);

  const referenceAssetId = input.referenceAssetId?.trim() || null;
  const referenceUrl = referenceAssetId
    ? await signedReferenceUrl({
        projectId: input.projectId,
        assetId: referenceAssetId,
      })
    : null;

  console.log(
    `[broll] generate size=${input.imageSize} ref=${referenceAssetId ?? "none"} query=${JSON.stringify(prompt)}`,
  );

  const candidates = await generateBrollStills({
    prompt,
    imageSize: input.imageSize,
    referenceUrl,
  });
  return { candidates };
}

export async function persistGeneratedBroll(input: {
  projectId: string;
  userId: string;
  url: string;
  width?: number | null;
  height?: number | null;
}): Promise<GeneratedAsset["client"]> {
  await requireEditorProject(input);
  if (!isAllowedGeneratedStillUrl(input.url)) {
    throw new Error("Image URL is not from generation");
  }
  const persisted = await persistImage({
    db,
    projectId: input.projectId,
    still: {
      url: input.url,
      width: input.width ?? null,
      height: input.height ?? null,
    },
    originalFilename: "generated.jpg",
  });
  return persisted.client;
}
