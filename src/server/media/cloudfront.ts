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
