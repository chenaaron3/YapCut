import {
  CloudFrontClient,
  CreateInvalidationCommand,
} from "@aws-sdk/client-cloudfront";
import { getSignedUrl } from "@aws-sdk/cloudfront-signer";

import { env } from "~/env";

function unescapePem(pem: string): string {
  return pem.includes("\\n") ? pem.replace(/\\n/g, "\n") : pem;
}

/** Signed CloudFront GET URL for private media (playback / download). */
export function signedCloudFrontUrl(
  s3Key: string,
  options?: { expiresInSec?: number },
): string {
  const expiresInSec = options?.expiresInSec ?? 60 * 60;
  const url = `https://${env.CLOUDFRONT_DOMAIN}/${s3Key.replace(/^\//, "")}`;
  const dateLessThan = new Date(Date.now() + expiresInSec * 1000).toISOString();

  return getSignedUrl({
    url,
    keyPairId: env.CLOUDFRONT_KEY_PAIR_ID,
    privateKey: unescapePem(env.CLOUDFRONT_PRIVATE_KEY),
    dateLessThan,
  });
}

let cloudFrontClient: CloudFrontClient | null = null;

function getCloudFrontClient(): CloudFrontClient {
  cloudFrontClient ??= new CloudFrontClient({
    region: env.AWS_REGION,
    credentials: {
      accessKeyId: env.AWS_ACCESS_KEY_ID,
      secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
    },
  });
  return cloudFrontClient;
}

/**
 * Invalidate CloudFront paths after S3 overwrites.
 * Paths may be S3 keys or already-slash-prefixed object paths.
 * Requires `CLOUDFRONT_DISTRIBUTION_ID` and `cloudfront:CreateInvalidation`.
 */
export async function invalidateCloudFrontPaths(
  s3Keys: string[],
): Promise<{ id: string; paths: string[] } | null> {
  const distributionId = env.CLOUDFRONT_DISTRIBUTION_ID;
  if (!distributionId || s3Keys.length === 0) return null;

  const paths = [
    ...new Set(
      s3Keys.map((key) => {
        const cleaned = key.replace(/^\//, "");
        return `/${cleaned}`;
      }),
    ),
  ];

  const result = await getCloudFrontClient().send(
    new CreateInvalidationCommand({
      DistributionId: distributionId,
      InvalidationBatch: {
        CallerReference: `sfx-${Date.now()}-${paths.length}`,
        Paths: {
          Quantity: paths.length,
          Items: paths,
        },
      },
    }),
  );

  const id = result.Invalidation?.Id;
  if (!id) {
    throw new Error("CloudFront CreateInvalidation returned no Invalidation.Id");
  }
  return { id, paths };
}
