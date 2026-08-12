import { projectRouter } from "~/server/api/routers/project";
import { scheduleRouter } from "~/server/api/routers/schedule";
import { createCallerFactory, createTRPCRouter } from "~/server/api/trpc";

export const appRouter = createTRPCRouter({
  project: projectRouter,
  schedule: scheduleRouter,
});

export type AppRouter = typeof appRouter;

export const createCaller = createCallerFactory(appRouter);
