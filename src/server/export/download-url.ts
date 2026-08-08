import type { AwsRegion } from "@remotion/lambda/client";

import { env } from "~/env";

function remotionRegion(): AwsRegion {
  return (env.REMOTION_AWS_REGION ?? env.AWS_REGION) as AwsRegion;
}

/** Public S3 URL for Remotion Lambda outputs (`privacy: "public"`). */
export async function exportDownloadUrl(options: {
  bucketName: string;
  objectKey: string;
}): Promise<string> {
  const region = remotionRegion();
  const key = options.objectKey.replace(/^\//, "");
  return `https://${options.bucketName}.s3.${region}.amazonaws.com/${key}`;
}
