import { asc, eq } from "drizzle-orm";

import {
  emptyProjectConfig,
  parseProjectConfig,
} from "~/domain/project-config";
import type { TranscriptWord } from "~/domain/transcript";
import { buildProjectProps } from "~/remotion/build-props";
import type { ProjectProps } from "~/remotion/types";
import { db } from "~/server/db";
import { assets, projects } from "~/server/db/schema";
import { signedCloudFrontUrl } from "~/server/media/cloudfront";

/** Long-lived signed URLs so Lambda can fetch media for the whole render. */
const EXPORT_MEDIA_TTL_SEC = 60 * 60 * 12;

function isEmptyConfig(value: unknown): boolean {
  if (value == null) return true;
  if (typeof value !== "object") return true;
  return Object.keys(value as object).length === 0;
}

export async function buildExportProps(
  projectId: string,
): Promise<ProjectProps> {
  const project = await db.query.projects.findFirst({
    where: eq(projects.id, projectId),
    columns: { id: true, config: true },
    with: {
      assets: {
        orderBy: [asc(assets.sortOrder)],
        columns: {
          id: true,
          kind: true,
          s3Key: true,
          durationSec: true,
          width: true,
          height: true,
        },
        with: {
          transcript: {
            columns: { words: true },
          },
        },
      },
    },
  });

  if (!project) {
    throw new Error(`Project ${projectId} not found`);
  }

  const config = isEmptyConfig(project.config)
    ? emptyProjectConfig()
    : parseProjectConfig(project.config);

  const mediaUrls = new Map<string, string>();
  const transcriptsByAssetId = new Map<string, readonly TranscriptWord[]>();
  const assetDurationSec = new Map<string, number>();
  const assetSize = new Map<string, { width: number; height: number }>();
  const assetKind = new Map<string, "video" | "image" | "audio">();

  for (const asset of project.assets) {
    mediaUrls.set(
      asset.id,
      signedCloudFrontUrl(asset.s3Key, { expiresInSec: EXPORT_MEDIA_TTL_SEC }),
    );
    assetKind.set(asset.id, asset.kind);
    if (asset.durationSec != null) {
      assetDurationSec.set(asset.id, asset.durationSec);
    }
    if (asset.width != null && asset.height != null) {
      assetSize.set(asset.id, { width: asset.width, height: asset.height });
    }
    const words = asset.transcript?.words;
    if (words) {
      transcriptsByAssetId.set(asset.id, words);
    }
  }

  return buildProjectProps({
    config,
    mediaUrls,
    transcriptsByAssetId,
    assetDurationSec,
    assetSize,
    assetKind,
  });
}
