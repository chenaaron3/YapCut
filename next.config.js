/**
 * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially useful
 * for Docker builds.
 */
import "./src/env.js";
import { withWorkflow } from "workflow/next";

/** @type {import("next").NextConfig} */
const config = {
  reactStrictMode: true,
  transpilePackages: [
    "next-auth",
    "remotion",
    "@remotion/player",
    "@remotion/media",
  ],

  /**
   * If you are using `appDir` then you must comment the below `i18n` config out.
   *
   * @see https://github.com/vercel/next.js/issues/41980
   */
  i18n: {
    locales: ["en"],
    defaultLocale: "en",
  },
};

/**
 * Workflow SDK is always configured here. Runtime create path is selected by
 * `USE_VERCEL_WORKFLOW` (see `src/server/create/start-create-pipeline.ts`):
 * false/unset → in-process; true → durable `createProjectWorkflow`.
 */
export default withWorkflow(config);
