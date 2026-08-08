/**
 * Deploy Remotion Lambda function + site. Prints env vars to paste into `.env`.
 *
 * Prerequisites (one-time IAM): https://www.remotion.dev/docs/lambda/setup
 *   - Role `remotion-lambda-role` with Remotion role policy
 *   - User policy for deploy credentials
 *   - Extend role policy to allow read/write on AWS_S3_BUCKET (exports/*)
 *
 * Usage: npm run remotion:deploy
 */
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  deployFunction,
  deploySite,
  getOrCreateBucket,
  type AwsRegion,
} from "@remotion/lambda";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SITE_NAME = "talking-head";
const REGION = (process.env.REMOTION_AWS_REGION ??
  process.env.AWS_REGION ??
  "us-east-1") as AwsRegion;

async function main() {
  if (!process.env.REMOTION_AWS_ACCESS_KEY_ID && process.env.AWS_ACCESS_KEY_ID) {
    process.env.REMOTION_AWS_ACCESS_KEY_ID = process.env.AWS_ACCESS_KEY_ID;
  }
  if (
    !process.env.REMOTION_AWS_SECRET_ACCESS_KEY &&
    process.env.AWS_SECRET_ACCESS_KEY
  ) {
    process.env.REMOTION_AWS_SECRET_ACCESS_KEY =
      process.env.AWS_SECRET_ACCESS_KEY;
  }

  if (
    !process.env.REMOTION_AWS_ACCESS_KEY_ID ||
    !process.env.REMOTION_AWS_SECRET_ACCESS_KEY
  ) {
    throw new Error(
      "Set REMOTION_AWS_ACCESS_KEY_ID / REMOTION_AWS_SECRET_ACCESS_KEY (or AWS_*)",
    );
  }

  console.log(`[remotion] region=${REGION}`);
  console.log("[remotion] ensuring bucket…");
  const { bucketName } = await getOrCreateBucket({ region: REGION });
  console.log(`[remotion] bucket=${bucketName}`);

  console.log("[remotion] deploying function…");
  const { functionName, alreadyExisted } = await deployFunction({
    region: REGION,
    timeoutInSeconds: 240,
    memorySizeInMb: 2048,
    createCloudWatchLogGroup: true,
    diskSizeInMb: 2048,
  });
  console.log(
    `[remotion] function=${functionName}${alreadyExisted ? " (existing)" : ""}`,
  );

  console.log("[remotion] bundling + uploading site…");
  const entryPoint = path.join(ROOT, "src/remotion/index.ts");
  const { serveUrl } = await deploySite({
    bucketName,
    entryPoint,
    region: REGION,
    siteName: SITE_NAME,
    options: {
      webpackOverride: (config) => ({
        ...config,
        resolve: {
          ...config.resolve,
          alias: {
            ...(config.resolve?.alias ?? {}),
            "~": path.join(ROOT, "src"),
          },
        },
      }),
      onBundleProgress: (p) => {
        if (p === 0 || p === 100 || p % 25 === 0) {
          console.log(`[remotion] bundle ${p}%`);
        }
      },
      onUploadProgress: ({ totalFiles, filesUploaded }) => {
        if (filesUploaded === totalFiles) {
          console.log(`[remotion] uploaded ${totalFiles} files`);
        }
      },
    },
  });

  console.log("\nAdd to .env:\n");
  console.log(`REMOTION_AWS_REGION=${REGION}`);
  console.log(`REMOTION_FUNCTION_NAME=${functionName}`);
  console.log(`REMOTION_SERVE_URL=${serveUrl}`);
  console.log("");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
