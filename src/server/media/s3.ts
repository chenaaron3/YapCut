import {
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import { env } from "~/env";

const PRESIGN_PUT_TTL_SEC = 60 * 60; // 1h
const PRESIGN_GET_TTL_SEC = 60 * 60; // 1h — enough for WhisperX to fetch

let client: S3Client | null = null;

function getS3Client(): S3Client {
  if (!client) {
    client = new S3Client({
      region: env.AWS_REGION,
      credentials: {
        accessKeyId: env.AWS_ACCESS_KEY_ID,
        secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
      },
    });
  }
  return client;
}

export async function presignPutObject(options: {
  key: string;
  contentType: string;
}): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: env.AWS_S3_BUCKET,
    Key: options.key,
    ContentType: options.contentType,
  });
  return getSignedUrl(getS3Client(), command, {
    expiresIn: PRESIGN_PUT_TTL_SEC,
  });
}

export async function presignGetObject(options: {
  key: string;
  expiresInSec?: number;
}): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: env.AWS_S3_BUCKET,
    Key: options.key,
  });
  return getSignedUrl(getS3Client(), command, {
    expiresIn: options.expiresInSec ?? PRESIGN_GET_TTL_SEC,
  });
}

function awsHttpStatus(error: unknown): number | undefined {
  if (!error || typeof error !== "object" || !("$metadata" in error)) {
    return undefined;
  }
  return (error as { $metadata?: { httpStatusCode?: number } }).$metadata
    ?.httpStatusCode;
}

/** Turn opaque AWS `UnknownError` into an actionable message. */
export function formatS3Error(error: unknown, action: string): Error {
  const status = awsHttpStatus(error);
  const name =
    error && typeof error === "object" && "name" in error
      ? String((error as { name: unknown }).name)
      : "Error";
  const message =
    error instanceof Error ? error.message : String(error ?? "unknown");

  if (status === 403 || name === "AccessDenied" || name === "Forbidden") {
    return new Error(
      `S3 ${action} denied (403). Check AWS_ACCESS_KEY_ID belongs to a user with AppMediaPolicy on bucket ${env.AWS_S3_BUCKET} (not a permissions-boundary-limited key).`,
    );
  }
  if (status === 404 || name === "NotFound" || name === "NoSuchKey") {
    return new Error(`S3 ${action}: object not found`);
  }
  return new Error(`S3 ${action} failed (${name}/${status ?? "?"}): ${message}`);
}

export async function headObject(
  key: string,
): Promise<{ contentLength?: number; contentType?: string } | null> {
  try {
    const result = await getS3Client().send(
      new HeadObjectCommand({
        Bucket: env.AWS_S3_BUCKET,
        Key: key,
      }),
    );
    return {
      contentLength: result.ContentLength,
      contentType: result.ContentType,
    };
  } catch (error) {
    const status = awsHttpStatus(error);
    const name =
      error && typeof error === "object" && "name" in error
        ? String((error as { name: unknown }).name)
        : "";
    if (name === "NotFound" || name === "NoSuchKey" || status === 404) {
      return null;
    }
    throw formatS3Error(error, `HeadObject ${key}`);
  }
}
