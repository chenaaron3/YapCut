import { env } from "~/env";

/** Remotion Lambda client reads REMOTION_AWS_* (falls back to AWS_*). */
export function ensureRemotionAwsEnv(): void {
  process.env.REMOTION_AWS_ACCESS_KEY_ID ??=
    process.env.AWS_ACCESS_KEY_ID ?? env.AWS_ACCESS_KEY_ID;
  process.env.REMOTION_AWS_SECRET_ACCESS_KEY ??=
    process.env.AWS_SECRET_ACCESS_KEY ?? env.AWS_SECRET_ACCESS_KEY;
  process.env.AWS_ACCESS_KEY_ID ??= env.AWS_ACCESS_KEY_ID;
  process.env.AWS_SECRET_ACCESS_KEY ??= env.AWS_SECRET_ACCESS_KEY;
}
