import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";

import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { projects } from "~/server/db/schema";

const projectListColumns = {
  id: projects.id,
  title: projects.title,
  status: projects.status,
  failureReason: projects.failureReason,
  updatedAt: projects.updatedAt,
  createdAt: projects.createdAt,
} as const;

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
      const [project] = await ctx.db
        .select(projectListColumns)
        .from(projects)
        .where(
          and(
            eq(projects.id, input.id),
            eq(projects.userId, ctx.session.user.id),
          ),
        )
        .limit(1);

      return project ?? null;
    }),
});
