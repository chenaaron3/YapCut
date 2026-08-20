/**
 * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially useful
 * for Docker builds.
 */
import path from "node:path";
import { fileURLToPath } from "node:url";

import "./src/env.js";
import { withWorkflow } from "workflow/next";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));

/** @type {import("next").NextConfig} */
const config = {
  reactStrictMode: true,
  // Multiple parent lockfiles confuse Next's workspace-root detection.
  outputFileTracingRoot: projectRoot,
  transpilePackages: [
    "next-auth",
    "remotion",
    "@remotion/player",
    "@remotion/media",
    "@remotion/lottie",
    "@remotion/paths",
  ],
  // Keep Vercel CLI config / xdg-app-paths out of the webpack graph — bundling
  // xdg-portable crashes page-data collection (path.parse(undefined)).
  serverExternalPackages: [
    "@vercel/cli-config",
    "@vercel/oidc",
    "xdg-app-paths",
    "xdg-portable",
    "playwright",
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
