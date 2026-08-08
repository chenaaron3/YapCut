/**
 * Remotion Lambda client uses REMOTION_AWS_* when set, else AWS_*.
 * Leave AWS_* alone so app media credentials stay intact in the same process.
 */
export function ensureRemotionAwsEnv(): void {
  if (!process.env.REMOTION_AWS_ACCESS_KEY_ID) {
    throw new Error(
      "REMOTION_AWS_ACCESS_KEY_ID is not set. Add Remotion IAM user keys to .env.",
    );
  }
  if (!process.env.REMOTION_AWS_SECRET_ACCESS_KEY) {
    throw new Error(
      "REMOTION_AWS_SECRET_ACCESS_KEY is not set. Add Remotion IAM user keys to .env.",
    );
  }
}
