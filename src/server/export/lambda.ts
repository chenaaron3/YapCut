import {
  getRenderProgress,
  renderMediaOnLambda,
  type AwsRegion,
} from "@remotion/lambda/client";

import { env } from "~/env";
import { COMPOSITION_ID } from "~/remotion/constants";
import type { ProjectProps } from "~/remotion/types";
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
  });

  return { renderId, bucketName };
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
      message: typeof e === "string" ? e : (e.message ?? String(e)),
    })),
    outputKey:
      typeof progress.outKey === "string" && progress.outKey.length > 0
        ? progress.outKey
        : null,
  };
}
