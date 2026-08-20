import { and, asc, eq, inArray, isNull } from "drizzle-orm";

import { maskEntry, maskProp, type MaskEntry } from "~/domain/asset/mask";
import {
  emptyProjectConfig,
  parseProjectConfig,
} from "~/domain/project/project-config";
import type { TranscriptWord } from "~/domain/transcript/transcript";
import { buildProjectProps, type PropsAsset } from "~/remotion/helpers/build-props";
import type { ProjectProps } from "~/remotion/helpers/types";
import { db } from "~/server/db";
import { assets, projects } from "~/server/db/schema";
import type { MaskRow } from "~/server/media/client-asset";
import { signedCloudFrontUrl } from "~/server/media/cloudfront";

/** Long-lived signed URLs so Lambda can fetch media for the whole render. */
const EXPORT_MEDIA_TTL_SEC = 60 * 60 * 12;

function isEmptyConfig(value: unknown): boolean {
  if (value == null) return true;
  if (typeof value !== "object") return true;
  return Object.keys(value).length === 0;
}

function exportMask(mask: MaskRow | null | undefined): MaskEntry | undefined {
  if (!mask?.enabled || !mask.s3Key) return undefined;
  return maskEntry(
    mask.type,
    signedCloudFrontUrl(mask.s3Key, { expiresInSec: EXPORT_MEDIA_TTL_SEC }),
  );
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
          mask: true,
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
    if (edit.kind === "sfx" || edit.kind === "broll") {
      if (!projectAssetIds.has(edit.assetId)) missingIds.add(edit.assetId);
    }
    if (
      edit.companionSfx &&
      !projectAssetIds.has(edit.companionSfx.assetId)
    ) {
      missingIds.add(edit.companionSfx.assetId);
    }
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

  const assetById = new Map<string, PropsAsset>();
  const transcriptsByAssetId = new Map<string, readonly TranscriptWord[]>();

  for (const asset of [...project.assets, ...globals]) {
    assetById.set(asset.id, {
      src: signedCloudFrontUrl(asset.s3Key, {
        expiresInSec: EXPORT_MEDIA_TTL_SEC,
      }),
      kind: asset.kind,
      durationSec: asset.durationSec,
      width: asset.width,
      height: asset.height,
      lufs: asset.lufs,
      truePeakDb: asset.truePeakDb,
      ...maskProp("mask" in asset ? exportMask(asset.mask) : undefined),
    });
    const words = asset.transcript?.words;
    if (words) {
      transcriptsByAssetId.set(asset.id, words);
    }
  }

  return buildProjectProps({
    config,
    title: project.title ?? undefined,
    transcriptsByAssetId,
    assets: assetById,
  });
}
