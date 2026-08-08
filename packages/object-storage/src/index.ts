import {
  CopyObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { loadEnv } from "@custom-os-ota/configuration";

let client: S3Client | undefined;

export function getS3Client(): S3Client {
  if (client) return client;
  const env = loadEnv();
  client = new S3Client({
    endpoint: env.S3_ENDPOINT,
    region: "us-east-1",
    credentials: {
      accessKeyId: env.S3_ACCESS_KEY_ID,
      secretAccessKey: env.S3_SECRET_ACCESS_KEY,
    },
    forcePathStyle: true,
  });
  return client;
}

export async function checkStorageHealth(): Promise<boolean> {
  try {
    const env = loadEnv();
    const s3 = getS3Client();
    await s3.send(new HeadBucketCommand({ Bucket: env.S3_BUCKET_QUARANTINE }));
    await s3.send(new HeadBucketCommand({ Bucket: env.S3_BUCKET_PUBLISHED }));
    return true;
  } catch {
    return false;
  }
}

export async function presignPutObject(params: {
  bucket: string;
  objectKey: string;
  contentType?: string;
  expiresInSeconds?: number;
}): Promise<string> {
  const s3 = getS3Client();
  const command = new PutObjectCommand({
    Bucket: params.bucket,
    Key: params.objectKey,
    ContentType: params.contentType ?? "application/zip",
  });
  return getSignedUrl(s3, command, { expiresIn: params.expiresInSeconds ?? 3600 });
}

export async function headObject(bucket: string, objectKey: string): Promise<{ size: bigint } | null> {
  try {
    const s3 = getS3Client();
    const result = await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: objectKey }));
    if (result.ContentLength == null) return null;
    return { size: BigInt(result.ContentLength) };
  } catch {
    return null;
  }
}

export function quarantineObjectKey(sessionId: string, filename: string): string {
  const safe = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `uploads/${sessionId}/${safe}`;
}

export async function copyObject(params: {
  sourceBucket: string;
  sourceKey: string;
  destBucket: string;
  destKey: string;
}): Promise<void> {
  const s3 = getS3Client();
  await s3.send(
    new CopyObjectCommand({
      Bucket: params.destBucket,
      Key: params.destKey,
      CopySource: `${params.sourceBucket}/${params.sourceKey}`,
    }),
  );
}

export async function putTextObject(params: {
  bucket: string;
  objectKey: string;
  body: string;
  contentType?: string;
}): Promise<void> {
  const s3 = getS3Client();
  await s3.send(
    new PutObjectCommand({
      Bucket: params.bucket,
      Key: params.objectKey,
      Body: params.body,
      ContentType: params.contentType ?? "text/plain; charset=utf-8",
      CacheControl: "max-age=300",
    }),
  );
}

export async function getTextObject(bucket: string, objectKey: string): Promise<string | null> {
  try {
    const s3 = getS3Client();
    const result = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: objectKey }));
    if (!result.Body) return null;
    return await result.Body.transformToString();
  } catch {
    return null;
  }
}
