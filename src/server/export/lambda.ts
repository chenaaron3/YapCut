import {
  getRenderProgress,
  renderMediaOnLambda,
  renderStillOnLambda,
  type AwsRegion,
} from "@remotion/lambda/client";

import { env } from "~/env";
import {
  COMPOSITION_ID,
  COVER_COMPOSITION_ID,
} from "~/remotion/helpers/constants";
import type { ProjectProps } from "~/remotion/helpers/types";
import { ensureRemotionAwsEnv } from "~/server/export/ensure-remotion-aws-env";

function remotionRegion(): AwsRegion {
  return (env.REMOTION_AWS_REGION ?? env.AWS_REGION) as AwsRegion;
}

function requireLambdaConfig(): {
  functionName: string;
  serveUrl: string;
  region: AwsRegion;
} {
  const functionName = env.REMOTION_FUNCTION_NAME;
  const serveUrl = env.REMOTION_SERVE_URL;
  if (!functionName || !serveUrl) {
    throw new Error(
      "Remotion Lambda is not configured. Set REMOTION_FUNCTION_NAME and REMOTION_SERVE_URL (run npm run remotion:deploy).",
    );
  }
  return {
    functionName,
    serveUrl,
    region: remotionRegion(),
  };
}

export async function startLambdaRender(options: {
  projectId: string;
  props: ProjectProps;
}): Promise<{
  renderId: string;
  bucketName: string;
}> {
  ensureRemotionAwsEnv();
  const { functionName, serveUrl, region } = requireLambdaConfig();

  const { renderId, bucketName } = await renderMediaOnLambda({
    region,
    functionName,
    serveUrl,
    composition: COMPOSITION_ID,
    inputProps: options.props,
    codec: "h264",
    imageFormat: "jpeg",
    maxRetries: 1,
    privacy: "public",
    downloadBehavior: {
      type: "download",
      fileName: `${options.projectId}.mp4`,
    },
    framesPerLambda: 40,
    // Occlude plate = source + mask Offthread extracts. Default cache evicts
    // long HEVC A-roll frames ("No frame found at position").
    offthreadVideoCacheSizeInBytes: 512 * 1024 * 1024,
    timeoutInMilliseconds: 120000,
  });

  return { renderId, bucketName };
}

/** Blocking Cover still — result is ready when the promise resolves. */
export async function renderCoverStill(options: {
  projectId: string;
  props: ProjectProps;
  bucketName: string;
}): Promise<{ coverS3Key: string }> {
  ensureRemotionAwsEnv();
  const { functionName, serveUrl, region } = requireLambdaConfig();

  const result = await renderStillOnLambda({
    region,
    functionName,
    serveUrl,
    composition: COVER_COMPOSITION_ID,
    inputProps: options.props,
    imageFormat: "jpeg",
    maxRetries: 1,
    privacy: "public",
    frame: 0,
    forceBucketName: options.bucketName,
    downloadBehavior: {
      type: "download",
      fileName: `${options.projectId}-cover.jpg`,
    },
  });

  const key = result.outKey;
  if (!key) {
    throw new Error("Cover still finished without an output key");
  }
  return { coverS3Key: key };
}

export type LambdaProgress = {
  done: boolean;
  overallProgress: number;
  fatalErrorEncountered: boolean;
  errors: Array<{ message: string }>;
  outputKey: string | null;
};

export async function fetchLambdaProgress(options: {
  renderId: string;
  bucketName: string;
}): Promise<LambdaProgress> {
  ensureRemotionAwsEnv();
  const { functionName, region } = requireLambdaConfig();

  const progress = await getRenderProgress({
    renderId: options.renderId,
    bucketName: options.bucketName,
    functionName,
    region,
  });

  return {
    done: progress.done,
    overallProgress: progress.overallProgress,
    fatalErrorEncountered: progress.fatalErrorEncountered,
    errors: (progress.errors ?? []).map((e) => ({
      message:
        typeof e === "string"
          ? e
          : typeof e === "object" &&
              e !== null &&
              "message" in e &&
              typeof e.message === "string"
            ? e.message
            : "Unknown error",
    })),
    outputKey:
      typeof progress.outKey === "string" && progress.outKey.length > 0
        ? progress.outKey
        : null,
  };
}
