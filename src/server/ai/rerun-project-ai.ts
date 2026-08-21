import { and, eq } from "drizzle-orm";

import { editsForAiAssist } from "~/domain/edit/edits";
import { parseProjectConfig } from "~/domain/project/project-config";
import { isEditorProjectStatus } from "~/domain/project/project-status";
import { runAiAssist, createAiAssistState } from "~/server/ai/run-ai-assist";
import { db } from "~/server/db";
import { assets, projects, transcripts } from "~/server/db/schema";

import type { TranscriptWord } from "~/domain/transcript/transcript";

/**
 * Re-run create AI assist on an editable project.
 * Keeps arolls + project fields + b-roll edits; replaces other edits + emphasis.
 */
export async function rerunProjectAiAssist(options: {
  projectId: string;
  userId: string;
}): Promise<{ configUpdatedAt: string }> {
  const [project] = await db
    .select()
    .from(projects)
    .where(
      and(
        eq(projects.id, options.projectId),
        eq(projects.userId, options.userId),
      ),
    )
    .limit(1);

  if (!project) {
    throw new Error("Project not found");
  }
  if (!isEditorProjectStatus(project.status)) {
    throw new Error(`Cannot run AI while status is ${project.status}`);
  }

  const config = parseProjectConfig(project.config);
  if (config.arolls.length === 0) {
    throw new Error("Project has no arolls");
  }

  const projectAssets = await db
    .select({
      id: assets.id,
      durationSec: assets.durationSec,
    })
    .from(assets)
    .where(eq(assets.projectId, options.projectId));

  const durationByAssetId = new Map<string, number>();
  for (const row of projectAssets) {
    if (row.durationSec != null) {
      durationByAssetId.set(row.id, row.durationSec);
    }
  }

  const wordsByAssetId = new Map<string, TranscriptWord[]>();
  const assetIds = [...new Set(config.arolls.map((k) => k.assetId))];
  for (const assetId of assetIds) {
    const [transcript] = await db
      .select()
      .from(transcripts)
      .where(eq(transcripts.assetId, assetId))
      .limit(1);
    if (!transcript || transcript.status !== "ready") {
      throw new Error(`Transcript not ready for asset ${assetId}`);
    }
    wordsByAssetId.set(assetId, transcript.words);
    if (!durationByAssetId.has(assetId)) {
      throw new Error(`Missing duration for asset ${assetId}`);
    }
  }

  const baseEdits = editsForAiAssist(config.edits);

  const assist = await runAiAssist(
    createAiAssistState({
      arolls: config.arolls,
      wordsByAssetId: Object.fromEntries(wordsByAssetId),
      durationByAssetId: Object.fromEntries(durationByAssetId),
      title: project.title?.trim() ?? "",
      generateTitleIfEmpty: true,
      edits: [...baseEdits],
      listicleStyle: config.listicleStyle,
      companionSfx: config.companionSfx,
    }),
  );

  for (const [assetId, words] of Object.entries(assist.wordsByAssetId)) {
    await db
      .update(transcripts)
      .set({ words, updatedAt: new Date() })
      .where(eq(transcripts.assetId, assetId));
  }

  const nextConfig = {
    ...config,
    edits: assist.edits,
  };

  const now = new Date();
  await db
    .update(projects)
    .set({
      title: assist.title.length > 0 ? assist.title : project.title,
      config: nextConfig,
      configUpdatedAt: now,
      updatedAt: now,
    })
    .where(eq(projects.id, options.projectId));

  return { configUpdatedAt: now.toISOString() };
}
