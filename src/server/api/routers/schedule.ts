import { z } from "zod";

import { canUseSchedule, scheduleSettingsSchema } from "~/domain/schedule/schedule";
import { getScheduleUploadService } from "~/schedule/upload-service";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import {
  scheduleProject,
  getOrCreateScheduleSettings,
  getScheduleEntryForProject,
  listScheduleQueue,
  updateScheduleSettings,
} from "~/server/schedule/service";

import { TRPCError } from "@trpc/server";

function asTrpc(err: unknown): never {
  const message = err instanceof Error ? err.message : String(err);
  throw new TRPCError({ code: "BAD_REQUEST", message });
}

export const scheduleRouter = createTRPCRouter({
  settings: protectedProcedure.query(async ({ ctx }) => {
    return getOrCreateScheduleSettings(ctx.session.user.id);
  }),

  updateSettings: protectedProcedure
    .input(scheduleSettingsSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        return await updateScheduleSettings(ctx.session.user.id, input);
      } catch (err) {
        asTrpc(err);
      }
    }),

  queue: protectedProcedure.query(async ({ ctx }) => {
    return listScheduleQueue(ctx.session.user.id);
  }),

  entryForProject: protectedProcedure
    .input(z.object({ projectId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const entry = await getScheduleEntryForProject({
        userId: ctx.session.user.id,
        projectId: input.projectId,
      });
      if (!entry) return null;
      return {
        id: entry.id,
        scheduledAt: entry.scheduledAt,
        platforms: entry.platformPublishes.map((p) => ({
          platform: p.platform,
          status: p.status,
          postUrl: p.postUrl,
          lastError: p.lastError,
        })),
      };
    }),

  addEntry: protectedProcedure
    .input(z.object({ projectId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      if (!canUseSchedule(ctx.session.user.email)) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Schedule is not available for this account",
        });
      }
      try {
        const entry = await scheduleProject({
          userId: ctx.session.user.id,
          projectId: input.projectId,
        });
        getScheduleUploadService().start({
          userId: ctx.session.user.id,
          projectId: input.projectId,
          entryId: entry.entryId,
          scheduledAt: entry.scheduledAt,
        });
        return entry;
      } catch (err) {
        asTrpc(err);
      }
    }),
});
