import { TRPCError } from "@trpc/server";
import { and, asc, count, desc, eq, inArray, isNull } from "drizzle-orm";
import { z } from "zod";

import { arollAssetOrder } from "~/domain/arolls";
import {
  assertCreateBatch,
  assertCreateUploadBytes,
  assertLandingCreateBatch,
  CREATE_MAX_BYTES,
} from "~/domain/create-limits";
import {
  emptyProjectConfig,
  parseProjectConfig,
  projectConfigSchema,
} from "~/domain/project-config";
import { MOTION_MAX_PROMPT, shotPlanSchema } from "~/domain/motion-config";
import {
  PROJECT_LIST_BADGES,
  PROJECT_LIST_PAGE_SIZE,
  projectListBadge,
} from "~/domain/project-list-badge";
import { isEditorProjectStatus } from "~/domain/project-status";
import { generateMotionPlan, motionFailMessage } from "~/server/ai/motion";
import { rerunProjectAiAssist } from "~/server/ai/rerun-project-ai";
import {
  createTRPCRouter,
  protectedProcedure,
  publicProcedure,
} from "~/server/api/trpc";
import {
  deleteAssetObjects,
  deleteDraftProject,
  requireDraftProject,
} from "~/server/create/draft-project";
import { parseCreateProgress } from "~/server/create/publish-progress";
import { startCreatePipeline } from "~/server/create/start-create-pipeline";
import { assets, projects, transcripts } from "~/server/db/schema";
import { exportDownloadUrl } from "~/server/export/download-url";
import { pollProjectExport } from "~/server/export/poll-export";
import { startProjectExport } from "~/server/export/start-export";
import {
  assertAssetsUploaded,
  insertAssetsAndPresign,
  nextAssetSortOrder,
} from "~/server/media/asset-upload";
import { signedCloudFrontUrl } from "~/server/media/cloudfront";
import { isGlobalMusicKey, isGlobalSfxKey } from "~/server/media/keys";
import { measureAsset } from "~/server/media/measure-asset";
import { canAccessProject, claimUnclaimedProject, sessionUserId } from "~/server/project-access";
import {
  projectListVisible,
  projectListWhere,
} from "~/server/project-list-query";

const createFileSchema = z.object({
  filename: z.string().min(1).max(512),
  contentType: z.string().min(1).max(255),
  size: z.number().int().nonnegative().max(CREATE_MAX_BYTES),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  /** Client-probed media duration (required for correct trailing gap layout). */
  durationSec: z.number().positive(),
});

const transcriptWordSchema = z.object({
  text: z.string(),
  start: z.number(),
  end: z.number(),
  emphasized: z.boolean().optional(),
});

function isEmptyConfig(value: unknown): boolean {
  if (value == null) return true;
  if (typeof value !== "object") return true;
  return Object.keys(value).length === 0;
}

function audioLibraryOf(
  s3Key: string,
  kind: "video" | "image" | "audio",
): "sfx" | "music" | null {
  if (kind !== "audio") return null;
  if (isGlobalSfxKey(s3Key)) return "sfx";
  if (isGlobalMusicKey(s3Key)) return "music";
  return "music";
}

/** Sign playback; never send s3Key. `audioLibrary` is derived from the key. */
function toClientAsset<
  T extends {
    kind: "video" | "image" | "audio";
    s3Key: string;
    waveformPeaks?: number[] | null;
    waveformPeaksPerSec?: number | null;
  },
>(row: T) {
  const { s3Key, waveformPeaks, waveformPeaksPerSec, ...rest } = row;
  const waveform =
    waveformPeaksPerSec != null &&
    Array.isArray(waveformPeaks) &&
    waveformPeaks.length > 0
      ? { peaksPerSec: waveformPeaksPerSec, peaks: waveformPeaks }
      : null;
  return {
    ...rest,
    playbackUrl: signedCloudFrontUrl(s3Key, { expiresInSec: 60 * 60 * 6 }),
    audioLibrary: audioLibraryOf(s3Key, row.kind),
    waveform,
  };
}

export const projectRouter = createTRPCRouter({
  list: protectedProcedure
    .input(
      z.object({
        page: z.number().int().min(1).default(1),
        query: z.string().max(512).default(""),
        status: z
          .union([z.literal("all"), z.enum(PROJECT_LIST_BADGES)])
          .default("all"),
      }),
    )
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const owned = projectListVisible(userId);
      const filtered = projectListWhere({
        userId,
        query: input.query,
        status: input.status,
      });

      const [[totalRow], [filteredRow]] = await Promise.all([
        ctx.db.select({ n: count() }).from(projects).where(owned),
        ctx.db.select({ n: count() }).from(projects).where(filtered),
      ]);
      const total = Number(totalRow?.n ?? 0);
      const filteredTotal = Number(filteredRow?.n ?? 0);
      const pageCount = Math.max(
        1,
        Math.ceil(filteredTotal / PROJECT_LIST_PAGE_SIZE),
      );
      const page = Math.min(input.page, pageCount);

      const pageRows = await ctx.db.query.projects.findMany({
        where: filtered,
        orderBy: [desc(projects.updatedAt)],
        limit: PROJECT_LIST_PAGE_SIZE,
        offset: (page - 1) * PROJECT_LIST_PAGE_SIZE,
        columns: {
          id: true,
          title: true,
          status: true,
          failureReason: true,
          createProgress: true,
          updatedAt: true,
          createdAt: true,
          coverS3Key: true,
          exportBucketName: true,
        },
        with: {
          scheduleEntry: {
            columns: { scheduledAt: true },
          },
        },
      });
      const pageIds = pageRows.map((row) => row.id);

      const videoAssets =
        pageIds.length === 0
          ? []
          : await ctx.db.query.assets.findMany({
              where: and(
                inArray(assets.projectId, pageIds),
                eq(assets.kind, "video"),
              ),
              orderBy: [asc(assets.sortOrder)],
              columns: { projectId: true, s3Key: true },
            });

      const firstVideoByProject = new Map<string, string>();
      for (const asset of videoAssets) {
        if (asset.projectId && !firstVideoByProject.has(asset.projectId)) {
          firstVideoByProject.set(asset.projectId, asset.s3Key);
        }
      }

      const items = await Promise.all(
        pageRows.map(async (row) => {
          const firstVideoKey = firstVideoByProject.get(row.id) ?? null;
          const coverUrl =
            row.coverS3Key && row.exportBucketName
              ? await exportDownloadUrl({
                  bucketName: row.exportBucketName,
                  objectKey: row.coverS3Key,
                })
              : null;
          const previewUrl =
            coverUrl ??
            (firstVideoKey
              ? signedCloudFrontUrl(firstVideoKey, {
                  expiresInSec: 60 * 60 * 6,
                })
              : null);
          return {
            id: row.id,
            title: row.title,
            status: row.status,
            failureReason: row.failureReason,
            createProgress: parseCreateProgress(row.createProgress),
            updatedAt: row.updatedAt,
            createdAt: row.createdAt,
            previewUrl,
            previewKind: coverUrl
              ? ("image" as const)
              : previewUrl
                ? ("video" as const)
                : null,
            scheduledAt: row.scheduleEntry?.scheduledAt ?? null,
            badge: projectListBadge(row.status),
          };
        }),
      );

      return { items, total, filteredTotal, page, pageCount };
    }),

  /** Global SFX + music libraries (`projectId` null). */
  listGlobalAssets: publicProcedure.query(async ({ ctx }) => {
    const rows = await ctx.db
      .select({
        id: assets.id,
        kind: assets.kind,
        s3Key: assets.s3Key,
        durationSec: assets.durationSec,
        width: assets.width,
        height: assets.height,
        originalFilename: assets.originalFilename,
        sortOrder: assets.sortOrder,
        lufs: assets.lufs,
        truePeakDb: assets.truePeakDb,
      })
      .from(assets)
      .where(and(isNull(assets.projectId), eq(assets.kind, "audio")))
      .orderBy(asc(assets.originalFilename));

    return rows.map(toClientAsset);
  }),

  byId: publicProcedure
    .input(z.object({ id: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      let project = await ctx.db.query.projects.findFirst({
        where: eq(projects.id, input.id),
        columns: {
          id: true,
          userId: true,
          title: true,
          status: true,
          failureReason: true,
          workflowRunId: true,
          createProgress: true,
          config: true,
          configUpdatedAt: true,
          exportS3Key: true,
          coverS3Key: true,
          exportBucketName: true,
          updatedAt: true,
          createdAt: true,
        },
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
              originalFilename: true,
              sortOrder: true,
              lufs: true,
              truePeakDb: true,
              waveformPeaksPerSec: true,
              waveformPeaks: true,
            },
            with: {
              transcript: {
                columns: {
                  words: true,
                  durationSec: true,
                  language: true,
                  status: true,
                },
              },
            },
          },
        },
      });

      if (!project) return null;

      if (project.userId == null && ctx.session?.user?.id) {
        const claimed = await claimUnclaimedProject(ctx.db, {
          projectId: project.id,
          userId: ctx.session.user.id,
        });
        if (claimed) project = { ...project, userId: ctx.session.user.id };
      }

      if (!canAccessProject(project, ctx.session)) return null;

      const downloadUrl =
        project.exportS3Key && project.exportBucketName
          ? await exportDownloadUrl({
              bucketName: project.exportBucketName,
              objectKey: project.exportS3Key,
            })
          : null;
      const coverDownloadUrl =
        project.coverS3Key && project.exportBucketName
          ? await exportDownloadUrl({
              bucketName: project.exportBucketName,
              objectKey: project.coverS3Key,
            })
          : null;

      return {
        ...project,
        createProgress: parseCreateProgress(project.createProgress),
        downloadUrl,
        coverDownloadUrl,
        config: isEmptyConfig(project.config)
          ? emptyProjectConfig()
          : parseProjectConfig(project.config),
        assets: project.assets.map(toClientAsset),
      };
    }),

  export: protectedProcedure
    .input(z.object({ id: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      try {
        return await startProjectExport({
          projectId: input.id,
          userId: ctx.session.user.id,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (message === "Project not found") {
          throw new TRPCError({ code: "NOT_FOUND", message });
        }
        throw new TRPCError({ code: "BAD_REQUEST", message });
      }
    }),

  exportProgress: protectedProcedure
    .input(z.object({ id: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      try {
        return await pollProjectExport({
          projectId: input.id,
          userId: ctx.session.user.id,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (message === "Project not found") {
          throw new TRPCError({ code: "NOT_FOUND", message });
        }
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message });
      }
    }),

  /**
   * Re-run create AI assist on current arolls/transcripts.
   * Keeps b-roll + Project fields; replaces other edits and emphasis.
   */
  runAiAssist: protectedProcedure
    .input(z.object({ id: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      try {
        return await rerunProjectAiAssist({
          projectId: input.id,
          userId: ctx.session.user.id,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (message === "Project not found") {
          throw new TRPCError({ code: "NOT_FOUND", message });
        }
        throw new TRPCError({ code: "BAD_REQUEST", message });
      }
    }),

  /** Rename Project.title column only — does not sync on-screen text VFX. */
  updateTitle: protectedProcedure
    .input(
      z.object({
        id: z.string().min(1),
        title: z.string().max(512),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [project] = await ctx.db
        .select({
          id: projects.id,
          status: projects.status,
        })
        .from(projects)
        .where(
          and(
            eq(projects.id, input.id),
            eq(projects.userId, ctx.session.user.id),
          ),
        )
        .limit(1);

      if (!project) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Project not found",
        });
      }

      if (!isEditorProjectStatus(project.status)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Cannot rename while status is ${project.status}`,
        });
      }

      const title = input.title.trim() || null;
      const now = new Date();
      await ctx.db
        .update(projects)
        .set({ title, updatedAt: now })
        .where(eq(projects.id, input.id));

      return { title };
    }),

  updateConfig: protectedProcedure
    .input(
      z.object({
        id: z.string().min(1),
        config: projectConfigSchema,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [project] = await ctx.db
        .select({
          id: projects.id,
          status: projects.status,
        })
        .from(projects)
        .where(
          and(
            eq(projects.id, input.id),
            eq(projects.userId, ctx.session.user.id),
          ),
        )
        .limit(1);

      if (!project) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Project not found",
        });
      }

      if (!isEditorProjectStatus(project.status)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Cannot update config while status is ${project.status}`,
        });
      }

      const now = new Date();
      await ctx.db
        .update(projects)
        .set({
          config: input.config,
          configUpdatedAt: now,
          updatedAt: now,
        })
        .where(eq(projects.id, input.id));

      // Keep A-roll Asset.sortOrder aligned with stitch order (config.arolls).
      const order = arollAssetOrder(input.config.arolls);
      for (let i = 0; i < order.length; i++) {
        await ctx.db
          .update(assets)
          .set({ sortOrder: i, updatedAt: now })
          .where(and(eq(assets.id, order[i]!), eq(assets.projectId, input.id)));
      }

      return { configUpdatedAt: now.toISOString() };
    }),

  generateMotion: protectedProcedure
    .input(
      z.object({
        id: z.string().min(1),
        start: z.number(),
        end: z.number(),
        prompt: z.string().min(1).max(MOTION_MAX_PROMPT),
        plan: z.unknown().nullable().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const parsedPlan = shotPlanSchema.safeParse(input.plan);
        return await generateMotionPlan({
          projectId: input.id,
          userId: ctx.session.user.id,
          start: input.start,
          end: input.end,
          prompt: input.prompt,
          plan: parsedPlan.success ? parsedPlan.data : null,
        });
      } catch (error) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: motionFailMessage(error),
        });
      }
    }),

  updateTranscriptWords: protectedProcedure
    .input(
      z.object({
        projectId: z.string().min(1),
        assetId: z.string().min(1),
        words: z.array(transcriptWordSchema),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [asset] = await ctx.db
        .select({
          id: assets.id,
          projectId: assets.projectId,
        })
        .from(assets)
        .where(eq(assets.id, input.assetId))
        .limit(1);

      if (asset?.projectId !== input.projectId) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Asset not found" });
      }

      const [project] = await ctx.db
        .select({ id: projects.id })
        .from(projects)
        .where(
          and(
            eq(projects.id, input.projectId),
            eq(projects.userId, ctx.session.user.id),
          ),
        )
        .limit(1);

      if (!project) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Project not found",
        });
      }

      const now = new Date();
      const updated = await ctx.db
        .update(transcripts)
        .set({ words: input.words, updatedAt: now })
        .where(eq(transcripts.assetId, input.assetId))
        .returning({ id: transcripts.id });

      if (updated.length === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Transcript not found",
        });
      }

      await ctx.db
        .update(projects)
        .set({ updatedAt: now })
        .where(eq(projects.id, input.projectId));

      return { ok: true as const };
    }),

  createStart: publicProcedure
    .input(
      z.object({
        title: z.string().max(512).optional(),
        files: z.array(createFileSchema).min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = sessionUserId(ctx.session);
      for (const file of input.files) {
        if (!file.contentType.startsWith("video/")) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Expected video content type, got ${file.contentType}`,
          });
        }
      }

      try {
        if (userId == null) assertLandingCreateBatch(input.files);
        else assertCreateBatch(input.files);
      } catch (error) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            error instanceof Error ? error.message : "Project exceeds limits",
        });
      }

      const trimmedTitle = input.title?.trim();
      const title =
        trimmedTitle !== undefined && trimmedTitle !== "" ? trimmedTitle : null;
      const projectId = crypto.randomUUID();

      await ctx.db.insert(projects).values({
        id: projectId,
        userId,
        title,
        status: "processing",
        config: {},
      });

      const uploads = await insertAssetsAndPresign({
        db: ctx.db,
        projectId,
        files: input.files.map((file, i) => ({
          filename: file.filename,
          contentType: file.contentType,
          kind: "video" as const,
          sortOrder: i,
          width: file.width,
          height: file.height,
          durationSec: file.durationSec,
        })),
      });

      return { projectId, uploads };
    }),

  /** Presign more A-roll clips onto an unstarted create draft. */
  createAddFiles: protectedProcedure
    .input(
      z.object({
        projectId: z.string().min(1),
        files: z.array(createFileSchema).min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await requireDraftProject(ctx.db, {
        projectId: input.projectId,
        userId: ctx.session.user.id,
      });

      for (const file of input.files) {
        if (!file.contentType.startsWith("video/")) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Expected video content type, got ${file.contentType}`,
          });
        }
      }

      const existing = await ctx.db
        .select({
          originalFilename: assets.originalFilename,
          durationSec: assets.durationSec,
          width: assets.width,
          height: assets.height,
        })
        .from(assets)
        .where(eq(assets.projectId, input.projectId));

      try {
        assertCreateBatch([
          ...existing.map((row) => ({
            filename: row.originalFilename ?? "clip",
            size: 0,
            durationSec: row.durationSec ?? 0,
            width: row.width ?? 1,
            height: row.height ?? 1,
          })),
          ...input.files,
        ]);
      } catch (error) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            error instanceof Error ? error.message : "Project exceeds limits",
        });
      }

      let nextSort = await nextAssetSortOrder(ctx.db, input.projectId);
      const uploads = await insertAssetsAndPresign({
        db: ctx.db,
        projectId: input.projectId,
        files: input.files.map((file) => ({
          filename: file.filename,
          contentType: file.contentType,
          kind: "video" as const,
          sortOrder: nextSort++,
          width: file.width,
          height: file.height,
          durationSec: file.durationSec,
        })),
      });

      return { projectId: input.projectId, uploads };
    }),

  createRemoveAsset: protectedProcedure
    .input(
      z.object({
        projectId: z.string().min(1),
        assetId: z.string().min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await requireDraftProject(ctx.db, {
        projectId: input.projectId,
        userId: ctx.session.user.id,
      });

      const [asset] = await ctx.db
        .select({ id: assets.id, s3Key: assets.s3Key })
        .from(assets)
        .where(
          and(
            eq(assets.id, input.assetId),
            eq(assets.projectId, input.projectId),
          ),
        )
        .limit(1);

      if (!asset) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Asset not found",
        });
      }

      await deleteAssetObjects([asset]);
      await ctx.db.delete(assets).where(eq(assets.id, asset.id));
      return { ok: true as const };
    }),

  createDiscard: publicProcedure
    .input(z.object({ projectId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      await requireDraftProject(ctx.db, {
        projectId: input.projectId,
        userId: sessionUserId(ctx.session),
      });
      await deleteDraftProject(ctx.db, input.projectId);
      return { ok: true as const };
    }),

  /** Delete a failed unclaimed Project so landing can start over. */
  abandonUnclaimed: publicProcedure
    .input(z.object({ projectId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const [project] = await ctx.db
        .select({
          id: projects.id,
          userId: projects.userId,
          status: projects.status,
        })
        .from(projects)
        .where(eq(projects.id, input.projectId))
        .limit(1);

      if (!project || project.userId != null || project.status !== "failed") {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Project not found",
        });
      }

      await deleteDraftProject(ctx.db, input.projectId);
      return { ok: true as const };
    }),

  createFinalize: publicProcedure
    .input(
      z.object({
        projectId: z.string().min(1),
        assetIds: z.array(z.string().min(1)).min(1).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await requireDraftProject(ctx.db, {
        projectId: input.projectId,
        userId: sessionUserId(ctx.session),
      });

      const allAssets = await ctx.db
        .select({
          id: assets.id,
          s3Key: assets.s3Key,
          originalFilename: assets.originalFilename,
        })
        .from(assets)
        .where(eq(assets.projectId, input.projectId))
        .orderBy(asc(assets.sortOrder));

      const orderedIds = input.assetIds ?? allAssets.map((row) => row.id);
      const byId = new Map(allAssets.map((row) => [row.id, row]));
      const projectAssets = orderedIds.map((id) => {
        const row = byId.get(id);
        if (!row) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "One or more assets are not on this project",
          });
        }
        return row;
      });

      if (projectAssets.length === 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Project has no assets",
        });
      }

      const keepIds = new Set(orderedIds);
      const extras = allAssets.filter((row) => !keepIds.has(row.id));
      if (extras.length > 0) {
        await deleteAssetObjects(extras);
        await ctx.db.delete(assets).where(
          inArray(
            assets.id,
            extras.map((row) => row.id),
          ),
        );
      }

      for (const [index, id] of orderedIds.entries()) {
        await ctx.db
          .update(assets)
          .set({ sortOrder: index })
          .where(eq(assets.id, id));
      }

      try {
        const uploaded = await assertAssetsUploaded(projectAssets);
        assertCreateUploadBytes(uploaded);
      } catch (error) {
        let reason =
          error instanceof Error
            ? error.message
            : "Could not verify upload in S3";
        if (reason.startsWith("Upload missing for ")) {
          reason = `${reason}. Re-create the project — the previous AWS keys likely could not PUT.`;
        }
        reason = reason.slice(0, 2000);
        await ctx.db
          .update(projects)
          .set({
            status: "failed",
            failureReason: reason,
            updatedAt: new Date(),
          })
          .where(eq(projects.id, input.projectId));
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: reason,
        });
      }

      await startCreatePipeline(input.projectId);

      return { projectId: input.projectId, status: "processing" as const };
    }),

  /**
   * Presign PUT for project-scoped image/video b-roll (or extra media).
   * Client probes width/height/duration before calling.
   */
  uploadAssetsStart: protectedProcedure
    .input(
      z.object({
        projectId: z.string().min(1),
        files: z
          .array(
            z.object({
              filename: z.string().min(1).max(512),
              contentType: z.string().min(1).max(255),
              size: z.number().int().nonnegative(),
              width: z.number().int().positive().optional(),
              height: z.number().int().positive().optional(),
              durationSec: z.number().positive().optional(),
            }),
          )
          .min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [project] = await ctx.db
        .select({ id: projects.id, status: projects.status })
        .from(projects)
        .where(
          and(
            eq(projects.id, input.projectId),
            eq(projects.userId, ctx.session.user.id),
          ),
        )
        .limit(1);

      if (!project) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Project not found",
        });
      }
      if (!isEditorProjectStatus(project.status)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Project is ${project.status}; upload only when ready`,
        });
      }

      let nextSort = await nextAssetSortOrder(ctx.db, input.projectId);
      const files = input.files.map((file) => {
        const isVideo = file.contentType.startsWith("video/");
        const isImage = file.contentType.startsWith("image/");
        const isAudio = file.contentType.startsWith("audio/");
        if (!isVideo && !isImage && !isAudio) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Expected image/*, video/*, or audio/*, got ${file.contentType}`,
          });
        }
        if ((isVideo || isAudio) && file.durationSec == null) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `${isAudio ? "Audio" : "Video"} ${file.filename} requires durationSec`,
          });
        }
        if (
          (isVideo || isImage) &&
          (file.width == null || file.height == null)
        ) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `${file.filename} requires width and height`,
          });
        }
        return {
          filename: file.filename,
          contentType: file.contentType,
          kind: isVideo
            ? ("video" as const)
            : isAudio
              ? ("audio" as const)
              : ("image" as const),
          sortOrder: nextSort++,
          width: file.width ?? null,
          height: file.height ?? null,
          durationSec: isVideo || isAudio ? file.durationSec! : null,
        };
      });

      const uploads = await insertAssetsAndPresign({
        db: ctx.db,
        projectId: input.projectId,
        files,
      });

      await ctx.db
        .update(projects)
        .set({ updatedAt: new Date() })
        .where(eq(projects.id, input.projectId));

      return { uploads };
    }),

  /** Verify S3 objects exist after client PUT; return signed playback rows. */
  uploadAssetsFinalize: protectedProcedure
    .input(
      z.object({
        projectId: z.string().min(1),
        assetIds: z.array(z.string().min(1)).min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [project] = await ctx.db
        .select({ id: projects.id })
        .from(projects)
        .where(
          and(
            eq(projects.id, input.projectId),
            eq(projects.userId, ctx.session.user.id),
          ),
        )
        .limit(1);

      if (!project) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Project not found",
        });
      }

      const matched = await ctx.db
        .select({
          id: assets.id,
          kind: assets.kind,
          s3Key: assets.s3Key,
          contentType: assets.contentType,
          durationSec: assets.durationSec,
          width: assets.width,
          height: assets.height,
          originalFilename: assets.originalFilename,
          sortOrder: assets.sortOrder,
          lufs: assets.lufs,
          truePeakDb: assets.truePeakDb,
        })
        .from(assets)
        .where(
          and(
            eq(assets.projectId, input.projectId),
            inArray(assets.id, input.assetIds),
          ),
        );

      if (matched.length !== input.assetIds.length) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "One or more assets not found on this project",
        });
      }

      try {
        await assertAssetsUploaded(matched);
      } catch (error) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            error instanceof Error
              ? error.message
              : "Could not verify upload in S3",
        });
      }

      for (const row of matched) {
        if (row.kind !== "audio") continue;
        try {
          await measureAsset(row);
        } catch (error) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: `Could not measure loudness for ${row.originalFilename ?? row.id}: ${
              error instanceof Error ? error.message : "unknown error"
            }`,
          });
        }
      }

      const measured = await ctx.db
        .select({
          id: assets.id,
          kind: assets.kind,
          s3Key: assets.s3Key,
          durationSec: assets.durationSec,
          width: assets.width,
          height: assets.height,
          originalFilename: assets.originalFilename,
          sortOrder: assets.sortOrder,
          lufs: assets.lufs,
          truePeakDb: assets.truePeakDb,
          waveformPeaksPerSec: assets.waveformPeaksPerSec,
          waveformPeaks: assets.waveformPeaks,
        })
        .from(assets)
        .where(
          and(
            eq(assets.projectId, input.projectId),
            inArray(assets.id, input.assetIds),
          ),
        );

      return {
        assets: measured.map(toClientAsset),
      };
    }),
});
