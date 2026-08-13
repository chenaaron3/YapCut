import { and, asc, eq, inArray, isNull } from "drizzle-orm";

import {
  emptyProjectConfig,
  parseProjectConfig,
} from "~/domain/project-config";
import type { TranscriptWord } from "~/domain/transcript";
import { buildProjectProps } from "~/remotion/helpers/build-props";
import type { ProjectProps } from "~/remotion/helpers/types";
import { db } from "~/server/db";
import { assets, projects } from "~/server/db/schema";
import { signedCloudFrontUrl } from "~/server/media/cloudfront";

/** Long-lived signed URLs so Lambda can fetch media for the whole render. */
const EXPORT_MEDIA_TTL_SEC = 60 * 60 * 12;

function isEmptyConfig(value: unknown): boolean {
  if (value == null) return true;
  if (typeof value !== "object") return true;
  return Object.keys(value).length === 0;
}

export async function buildExportProps(
  projectId: string,
): Promise<ProjectProps> {
  const project = await db.query.projects.findFirst({
    where: eq(projects.id, projectId),
    columns: { id: true, config: true, title: true },
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
          lufs: true,
          truePeakDb: true,
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

  const projectAssetIds = new Set(project.assets.map((a) => a.id));
  const missingIds = new Set<string>();
  for (const edit of config.edits) {
    if (edit.kind !== "sfx" && edit.kind !== "broll") continue;
    if (!projectAssetIds.has(edit.assetId)) missingIds.add(edit.assetId);
  }
  if (config.music && !projectAssetIds.has(config.music.assetId)) {
    missingIds.add(config.music.assetId);
  }
  const globals =
    missingIds.size === 0
      ? []
      : (
          await db
            .select({
              id: assets.id,
              kind: assets.kind,
              s3Key: assets.s3Key,
              durationSec: assets.durationSec,
              width: assets.width,
              height: assets.height,
              lufs: assets.lufs,
              truePeakDb: assets.truePeakDb,
            })
            .from(assets)
            .where(
              and(
                isNull(assets.projectId),
                inArray(assets.id, [...missingIds]),
              ),
            )
        ).map((a) => ({ ...a, transcript: null }));

  const mediaUrls = new Map<string, string>();
  const transcriptsByAssetId = new Map<string, readonly TranscriptWord[]>();
  const assetDurationSec = new Map<string, number>();
  const assetSize = new Map<string, { width: number; height: number }>();
  const assetKind = new Map<string, "video" | "image" | "audio">();
  const assetLoudness = new Map<
    string,
    { lufs: number | null; truePeakDb: number | null }
  >();

  for (const asset of [...project.assets, ...globals]) {
    mediaUrls.set(
      asset.id,
      signedCloudFrontUrl(asset.s3Key, { expiresInSec: EXPORT_MEDIA_TTL_SEC }),
    );
    assetKind.set(asset.id, asset.kind);
    assetLoudness.set(asset.id, {
      lufs: asset.lufs,
      truePeakDb: asset.truePeakDb,
    });
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
    title: project.title ?? undefined,
    mediaUrls,
    transcriptsByAssetId,
    assetDurationSec,
    assetSize,
    assetKind,
    assetLoudness,
  });
}
