import { and, asc, desc, eq, inArray, isNull } from "drizzle-orm";
import { z } from "zod";

import {
  emptyProjectConfig,
  parseProjectConfig,
  projectConfigSchema,
} from "~/domain/project-config";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
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

import { TRPCError } from "@trpc/server";

const projectListColumns = {
  id: projects.id,
  title: projects.title,
  status: projects.status,
  failureReason: projects.failureReason,
  updatedAt: projects.updatedAt,
  createdAt: projects.createdAt,
} as const;

const createFileSchema = z.object({
  filename: z.string().min(1).max(512),
  contentType: z.string().min(1).max(255),
  size: z.number().int().nonnegative(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
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

export const projectRouter = createTRPCRouter({
  list: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db
      .select(projectListColumns)
      .from(projects)
      .where(eq(projects.userId, ctx.session.user.id))
      .orderBy(desc(projects.updatedAt));
  }),

  /** Global SFX library (`projectId` null, `kind` audio). */
  listGlobalSfx: protectedProcedure.query(async ({ ctx }) => {
    const rows = await ctx.db
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
      })
      .from(assets)
      .where(and(isNull(assets.projectId), eq(assets.kind, "audio")))
      .orderBy(asc(assets.originalFilename));

    return rows.map(({ s3Key, ...asset }) => ({
      ...asset,
      playbackUrl: signedCloudFrontUrl(s3Key, {
        expiresInSec: 60 * 60 * 6,
      }),
    }));
  }),

  byId: protectedProcedure
    .input(z.object({ id: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const project = await ctx.db.query.projects.findFirst({
        where: and(
          eq(projects.id, input.id),
          eq(projects.userId, ctx.session.user.id),
        ),
        columns: {
          id: true,
          title: true,
          status: true,
          failureReason: true,
          config: true,
          configUpdatedAt: true,
          exportS3Key: true,
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
              contentType: true,
              durationSec: true,
              width: true,
              height: true,
              originalFilename: true,
              sortOrder: true,
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

      const downloadUrl =
        project.exportS3Key && project.exportBucketName
          ? await exportDownloadUrl({
              bucketName: project.exportBucketName,
              objectKey: project.exportS3Key,
            })
          : null;

      return {
        ...project,
        downloadUrl,
        config: isEmptyConfig(project.config)
          ? emptyProjectConfig()
          : parseProjectConfig(project.config),
        assets: project.assets.map(({ s3Key, ...asset }) => ({
          ...asset,
          playbackUrl: signedCloudFrontUrl(s3Key, {
            expiresInSec: 60 * 60 * 6,
          }),
        })),
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
        throw new TRPCError({ code: "NOT_FOUND", message: "Project not found" });
      }

      if (project.status !== "ready" && project.status !== "exporting") {
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
        throw new TRPCError({ code: "NOT_FOUND", message: "Project not found" });
      }

      if (project.status !== "ready" && project.status !== "exporting") {
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

      return { configUpdatedAt: now.toISOString() };
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
        throw new TRPCError({ code: "NOT_FOUND", message: "Project not found" });
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

  createStart: protectedProcedure
    .input(
      z.object({
        title: z.string().max(512).optional(),
        files: z.array(createFileSchema).min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      for (const file of input.files) {
        if (!file.contentType.startsWith("video/")) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Expected video content type, got ${file.contentType}`,
          });
        }
      }

      const trimmedTitle = input.title?.trim();
      const title =
        trimmedTitle !== undefined && trimmedTitle !== ""
          ? trimmedTitle
          : null;
      const projectId = crypto.randomUUID();

      await ctx.db.insert(projects).values({
        id: projectId,
        userId: ctx.session.user.id,
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
          width: file.width ?? null,
          height: file.height ?? null,
          durationSec: file.durationSec,
        })),
      });

      return { projectId, uploads };
    }),

  createFinalize: protectedProcedure
    .input(z.object({ projectId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const [project] = await ctx.db
        .select({
          id: projects.id,
          status: projects.status,
          userId: projects.userId,
        })
        .from(projects)
        .where(
          and(
            eq(projects.id, input.projectId),
            eq(projects.userId, ctx.session.user.id),
          ),
        )
        .limit(1);

      if (!project) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Project not found" });
      }

      if (project.status !== "processing") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Project is ${project.status}, expected processing`,
        });
      }

      const projectAssets = await ctx.db
        .select({
          id: assets.id,
          s3Key: assets.s3Key,
          originalFilename: assets.originalFilename,
        })
        .from(assets)
        .where(eq(assets.projectId, input.projectId))
        .orderBy(asc(assets.sortOrder));

      if (projectAssets.length === 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Project has no assets",
        });
      }

      try {
        await assertAssetsUploaded(projectAssets);
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
              width: z.number().int().positive(),
              height: z.number().int().positive(),
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
        throw new TRPCError({ code: "NOT_FOUND", message: "Project not found" });
      }
      if (project.status !== "ready" && project.status !== "exporting") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Project is ${project.status}; upload only when ready`,
        });
      }

      let nextSort = await nextAssetSortOrder(ctx.db, input.projectId);
      const files = input.files.map((file) => {
        const isVideo = file.contentType.startsWith("video/");
        const isImage = file.contentType.startsWith("image/");
        if (!isVideo && !isImage) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Expected image/* or video/*, got ${file.contentType}`,
          });
        }
        if (isVideo && file.durationSec == null) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Video ${file.filename} requires durationSec`,
          });
        }
        return {
          filename: file.filename,
          contentType: file.contentType,
          kind: isVideo ? ("video" as const) : ("image" as const),
          sortOrder: nextSort++,
          width: file.width,
          height: file.height,
          durationSec: isVideo ? file.durationSec! : null,
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
        throw new TRPCError({ code: "NOT_FOUND", message: "Project not found" });
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

      return {
        assets: matched.map(({ s3Key, ...asset }) => ({
          ...asset,
          playbackUrl: signedCloudFrontUrl(s3Key, {
            expiresInSec: 60 * 60 * 6,
          }),
        })),
      };
    }),
});
