import { and, asc, desc, eq } from "drizzle-orm";
import { z } from "zod";

import {
  emptyProjectConfig,
  parseProjectConfig,
  projectConfigSchema,
} from "~/domain/project-config";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { startCreatePipeline } from "~/server/create/start-create-pipeline";
import { assets, projects, transcripts } from "~/server/db/schema";
import { signedCloudFrontUrl } from "~/server/media/cloudfront";
import { assetSourceKey } from "~/server/media/keys";
import { headObject, presignPutObject } from "~/server/media/s3";

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
  return Object.keys(value as object).length === 0;
}

export const projectRouter = createTRPCRouter({
  list: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db
      .select(projectListColumns)
      .from(projects)
      .where(eq(projects.userId, ctx.session.user.id))
      .orderBy(desc(projects.updatedAt));
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

      return {
        ...project,
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

      if (!asset || asset.projectId !== input.projectId) {
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

      const title = input.title?.trim() || null;
      const projectId = crypto.randomUUID();

      await ctx.db.insert(projects).values({
        id: projectId,
        userId: ctx.session.user.id,
        title,
        status: "processing",
        config: {},
      });

      const uploads: Array<{
        assetId: string;
        s3Key: string;
        uploadUrl: string;
        contentType: string;
      }> = [];

      for (let i = 0; i < input.files.length; i++) {
        const file = input.files[i]!;
        const assetId = crypto.randomUUID();
        const s3Key = assetSourceKey(projectId, assetId);

        await ctx.db.insert(assets).values({
          id: assetId,
          projectId,
          kind: "video",
          s3Key,
          contentType: file.contentType,
          originalFilename: file.filename,
          sortOrder: i,
        });

        const uploadUrl = await presignPutObject({
          key: s3Key,
          contentType: file.contentType,
        });

        uploads.push({
          assetId,
          s3Key,
          uploadUrl,
          contentType: file.contentType,
        });
      }

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

      for (const asset of projectAssets) {
        let head;
        try {
          head = await headObject(asset.s3Key);
        } catch (error) {
          const reason =
            error instanceof Error
              ? error.message
              : "Could not verify upload in S3";
          await ctx.db
            .update(projects)
            .set({
              status: "failed",
              failureReason: reason.slice(0, 2000),
              updatedAt: new Date(),
            })
            .where(eq(projects.id, input.projectId));
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: reason,
          });
        }
        if (!head) {
          const reason = `Upload missing for ${asset.originalFilename ?? asset.id} (nothing at s3://${asset.s3Key}). Re-create the project — the previous AWS keys likely could not PUT.`;
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
      }

      await startCreatePipeline(input.projectId);

      return { projectId: input.projectId, status: "processing" as const };
    }),
});
