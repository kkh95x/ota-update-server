import { createHash } from "node:crypto";
import {
  AbortMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  CopyObjectCommand,
  CreateMultipartUploadCommand,
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  ListPartsCommand,
  PutObjectCommand,
  UploadPartCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { loadEnv } from "@custom-os-ota/configuration";

let client: S3Client | undefined;
let publicClient: S3Client | undefined;

function s3ClientOptions(endpoint: string, forcePathStyle: boolean) {
  const env = loadEnv();
  return {
    endpoint,
    region: "us-east-1",
    credentials: {
      accessKeyId: env.S3_ACCESS_KEY_ID,
      secretAccessKey: env.S3_SECRET_ACCESS_KEY,
    },
    forcePathStyle,
    // Default SDK checksums break browser presigned PUT (CRC32 hoisted to query string).
    requestChecksumCalculation: "WHEN_REQUIRED" as const,
    responseChecksumValidation: "WHEN_REQUIRED" as const,
  };
}

export function getS3Client(): S3Client {
  if (client) return client;
  const env = loadEnv();
  client = new S3Client(s3ClientOptions(env.S3_ENDPOINT, env.S3_FORCE_PATH_STYLE));
  return client;
}

/** Presigned URLs must target the browser-reachable endpoint (often nginx /s3/). */
export function getPublicS3Client(): S3Client {
  if (publicClient) return publicClient;
  const env = loadEnv();
  const { signingEndpoint } = resolvePublicS3Endpoint(env.S3_PUBLIC_ENDPOINT);
  publicClient = new S3Client(s3ClientOptions(signingEndpoint, env.S3_FORCE_PATH_STYLE));
  return publicClient;
}

/**
 * nginx serves MinIO under /s3/ but strips that prefix before proxying.
 * SigV4 must be computed for the path MinIO sees (/bucket/key), then /s3 is
 * inserted into the browser URL only.
 */
function resolvePublicS3Endpoint(publicEndpoint: string): {
  signingEndpoint: string;
  nginxPathPrefix: string;
} {
  const url = new URL(publicEndpoint);
  if (url.pathname === "/s3" || url.pathname === "/s3/") {
    return { signingEndpoint: url.origin, nginxPathPrefix: "/s3" };
  }
  return { signingEndpoint: publicEndpoint.replace(/\/$/, ""), nginxPathPrefix: "" };
}

function browserPresignedUrl(signedUrl: string, nginxPathPrefix: string): string {
  if (!nginxPathPrefix) return signedUrl;
  const parsed = new URL(signedUrl);
  parsed.pathname = `${nginxPathPrefix}${parsed.pathname}`;
  return parsed.toString();
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
  const env = loadEnv();
  const { signingEndpoint, nginxPathPrefix } = resolvePublicS3Endpoint(env.S3_PUBLIC_ENDPOINT);
  const s3 = new S3Client(s3ClientOptions(signingEndpoint, env.S3_FORCE_PATH_STYLE));
  const command = new PutObjectCommand({
    Bucket: params.bucket,
    Key: params.objectKey,
    ContentType: params.contentType ?? "application/zip",
  });
  const signed = await getSignedUrl(s3, command, { expiresIn: params.expiresInSeconds ?? 3600 });
  return browserPresignedUrl(signed, nginxPathPrefix);
}

const MIN_MULTIPART_PART_BYTES = 5 * 1024 * 1024;

/** Part count and size for S3 multipart (MinIO: 5 MiB min per part except the last). */
export function planMultipartUpload(fileSize: number, preferredPartSize: number): {
  partSize: number;
  partCount: number;
} {
  if (fileSize <= 0) {
    throw new Error("invalid_file_size");
  }
  let partSize = Math.max(MIN_MULTIPART_PART_BYTES, preferredPartSize);
  let partCount = Math.ceil(fileSize / partSize);
  const maxParts = 10_000;
  if (partCount > maxParts) {
    partSize = Math.ceil(fileSize / maxParts);
    partCount = Math.ceil(fileSize / partSize);
  }
  return { partSize, partCount };
}

export async function createMultipartUpload(params: {
  bucket: string;
  objectKey: string;
  contentType?: string;
}): Promise<string> {
  const s3 = getS3Client();
  const result = await s3.send(
    new CreateMultipartUploadCommand({
      Bucket: params.bucket,
      Key: params.objectKey,
      ContentType: params.contentType ?? "application/zip",
    }),
  );
  if (!result.UploadId) {
    throw new Error("multipart_upload_id_missing");
  }
  return result.UploadId;
}

export async function presignUploadPart(params: {
  bucket: string;
  objectKey: string;
  uploadId: string;
  partNumber: number;
  expiresInSeconds?: number;
}): Promise<string> {
  const env = loadEnv();
  const { signingEndpoint, nginxPathPrefix } = resolvePublicS3Endpoint(env.S3_PUBLIC_ENDPOINT);
  const s3 = new S3Client(s3ClientOptions(signingEndpoint, env.S3_FORCE_PATH_STYLE));
  const command = new UploadPartCommand({
    Bucket: params.bucket,
    Key: params.objectKey,
    UploadId: params.uploadId,
    PartNumber: params.partNumber,
  });
  const signed = await getSignedUrl(s3, command, { expiresIn: params.expiresInSeconds ?? 3600 });
  return browserPresignedUrl(signed, nginxPathPrefix);
}

export async function presignAllUploadParts(params: {
  bucket: string;
  objectKey: string;
  uploadId: string;
  partCount: number;
  expiresInSeconds?: number;
}): Promise<Array<{ partNumber: number; uploadUrl: string }>> {
  const parts: Array<{ partNumber: number; uploadUrl: string }> = [];
  for (let partNumber = 1; partNumber <= params.partCount; partNumber++) {
    const uploadUrl = await presignUploadPart({
      bucket: params.bucket,
      objectKey: params.objectKey,
      uploadId: params.uploadId,
      partNumber,
      expiresInSeconds: params.expiresInSeconds,
    });
    parts.push({ partNumber, uploadUrl });
  }
  return parts;
}

/** S3 expects quoted ETags; browsers may strip or alter them. */
export function normalizePartEtag(etag: string): string {
  const trimmed = etag.trim();
  if (!trimmed) return trimmed;
  if (trimmed.startsWith("W/")) return trimmed;
  if (trimmed.startsWith('"') && trimmed.endsWith('"')) return trimmed;
  return `"${trimmed.replace(/^"|"$/g, "")}"`;
}

export async function listMultipartParts(params: {
  bucket: string;
  objectKey: string;
  uploadId: string;
}): Promise<Array<{ partNumber: number; etag: string; size: number }>> {
  const s3 = getS3Client();
  const parts: Array<{ partNumber: number; etag: string; size: number }> = [];
  let partNumberMarker: string | undefined;

  for (;;) {
    const result = await s3.send(
      new ListPartsCommand({
        Bucket: params.bucket,
        Key: params.objectKey,
        UploadId: params.uploadId,
        PartNumberMarker: partNumberMarker,
      }),
    );
    for (const part of result.Parts ?? []) {
      if (part.PartNumber != null && part.ETag && part.Size != null) {
        parts.push({
          partNumber: part.PartNumber,
          etag: part.ETag,
          size: part.Size,
        });
      }
    }
    if (!result.IsTruncated || result.NextPartNumberMarker == null) break;
    partNumberMarker = String(result.NextPartNumberMarker);
  }

  return parts.sort((a, b) => a.partNumber - b.partNumber);
}

export async function completeMultipartUpload(params: {
  bucket: string;
  objectKey: string;
  uploadId: string;
  parts: Array<{ partNumber: number; etag: string }>;
}): Promise<void> {
  const s3 = getS3Client();
  await s3.send(
    new CompleteMultipartUploadCommand({
      Bucket: params.bucket,
      Key: params.objectKey,
      UploadId: params.uploadId,
      MultipartUpload: {
        Parts: params.parts
          .slice()
          .sort((a, b) => a.partNumber - b.partNumber)
          .map((p) => ({
            PartNumber: p.partNumber,
            ETag: normalizePartEtag(p.etag),
          })),
      },
    }),
  );
}

export async function abortMultipartUpload(params: {
  bucket: string;
  objectKey: string;
  uploadId: string;
}): Promise<void> {
  const s3 = getS3Client();
  await s3.send(
    new AbortMultipartUploadCommand({
      Bucket: params.bucket,
      Key: params.objectKey,
      UploadId: params.uploadId,
    }),
  );
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

export async function getObjectRange(
  bucket: string,
  objectKey: string,
  start: number,
  end: number,
): Promise<Buffer> {
  const s3 = getS3Client();
  const result = await s3.send(
    new GetObjectCommand({
      Bucket: bucket,
      Key: objectKey,
      Range: `bytes=${start}-${end}`,
    }),
  );
  if (!result.Body) {
    throw new Error("empty_range_response");
  }
  const chunks: Buffer[] = [];
  for await (const chunk of result.Body as AsyncIterable<Uint8Array>) {
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

export async function streamObjectSha256(bucket: string, objectKey: string): Promise<string> {
  const s3 = getS3Client();
  const result = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: objectKey }));
  if (!result.Body) {
    throw new Error("empty_object_body");
  }
  const hash = createHash("sha256");
  for await (const chunk of result.Body as AsyncIterable<Uint8Array>) {
    hash.update(chunk);
  }
  return hash.digest("hex");
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
