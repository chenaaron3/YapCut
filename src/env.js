import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  /**
   * Specify your server-side environment variables schema here. This way you can ensure the app
   * isn't built with invalid env vars.
   */
  server: {
    AUTH_SECRET:
      process.env.NODE_ENV === "production"
        ? z.string()
        : z.string().optional(),
    AUTH_GOOGLE_ID: z.string(),
    AUTH_GOOGLE_SECRET: z.string(),
    DATABASE_URL: z.string().url(),
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    AWS_REGION: z.string().min(1),
    AWS_ACCESS_KEY_ID: z.string().min(1),
    AWS_SECRET_ACCESS_KEY: z.string().min(1),
    AWS_S3_BUCKET: z.string().min(1),
    CLOUDFRONT_DOMAIN: z.string().min(1),
    CLOUDFRONT_KEY_PAIR_ID: z.string().min(1),
    CLOUDFRONT_PRIVATE_KEY: z.string().min(1),
    /** Optional; used by seed:global-sfx to invalidate CDN after SFX overwrites. */
    CLOUDFRONT_DISTRIBUTION_ID: z.string().min(1).optional(),
    OPENAI_API_KEY: z.string().min(1),
    REPLICATE_API_TOKEN: z.string().min(1),
    /** When "true", start create via Vercel Workflow SDK; else in-process. */
    USE_VERCEL_WORKFLOW: z
      .enum(["true", "false"])
      .optional()
      .transform((v) => v === "true"),
    /** Remotion Lambda function name from `npm run remotion:deploy`. */
    REMOTION_FUNCTION_NAME: z.string().min(1).optional(),
    /** Remotion Lambda serve URL from site deploy. */
    REMOTION_SERVE_URL: z.string().url().optional(),
    /** Region for Remotion Lambda (defaults to AWS_REGION). */
    REMOTION_AWS_REGION: z.string().min(1).optional(),
  },

  /**
   * Specify your client-side environment variables schema here. This way you can ensure the app
   * isn't built with invalid env vars. To expose them to the client, prefix them with
   * `NEXT_PUBLIC_`.
   */
  client: {
    // NEXT_PUBLIC_CLIENTVAR: z.string(),
  },

  /**
   * You can't destruct `process.env` as a regular object in the Next.js edge runtimes (e.g.
   * middlewares) or client-side so we need to destruct manually.
   */
  runtimeEnv: {
    AUTH_SECRET: process.env.AUTH_SECRET,
    AUTH_GOOGLE_ID: process.env.AUTH_GOOGLE_ID,
    AUTH_GOOGLE_SECRET: process.env.AUTH_GOOGLE_SECRET,
    DATABASE_URL: process.env.DATABASE_URL,
    NODE_ENV: process.env.NODE_ENV,
    AWS_REGION: process.env.AWS_REGION,
    AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID,
    AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY,
    AWS_S3_BUCKET: process.env.AWS_S3_BUCKET,
    CLOUDFRONT_DOMAIN: process.env.CLOUDFRONT_DOMAIN,
    CLOUDFRONT_KEY_PAIR_ID: process.env.CLOUDFRONT_KEY_PAIR_ID,
    CLOUDFRONT_PRIVATE_KEY: process.env.CLOUDFRONT_PRIVATE_KEY,
    CLOUDFRONT_DISTRIBUTION_ID: process.env.CLOUDFRONT_DISTRIBUTION_ID,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    REPLICATE_API_TOKEN: process.env.REPLICATE_API_TOKEN,
    USE_VERCEL_WORKFLOW: process.env.USE_VERCEL_WORKFLOW,
    REMOTION_FUNCTION_NAME: process.env.REMOTION_FUNCTION_NAME,
    REMOTION_SERVE_URL: process.env.REMOTION_SERVE_URL,
    REMOTION_AWS_REGION: process.env.REMOTION_AWS_REGION,
  },
  /**
   * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially
   * useful for Docker builds.
   */
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
  /**
   * Makes it so that empty strings are treated as undefined. `SOME_VAR: z.string()` and
   * `SOME_VAR=''` will throw an error.
   */
  emptyStringAsUndefined: true,
});
