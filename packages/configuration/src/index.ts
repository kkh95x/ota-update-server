import { z } from "zod";
import { loadRootEnv } from "./load-root-env.js";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z
    .string()
    .min(1)
    .refine((v) => v.startsWith("postgresql://") || v.startsWith("postgres://"), {
      message: "must be a PostgreSQL connection URL",
    }),
  REDIS_URL: z
    .string()
    .min(1)
    .refine((v) => v.startsWith("redis://"), { message: "must be a Redis connection URL" }),
  AUTH_SECRET: z.string().min(32),
  CSRF_SECRET: z.string().min(32),
  OTA_PUBLIC_BASE_URL: z.string().url().endsWith("/"),
  S3_ENDPOINT: z.string().url(),
  S3_PUBLIC_ENDPOINT: z.string().url(),
  S3_ACCESS_KEY_ID: z.string().min(1),
  S3_SECRET_ACCESS_KEY: z.string().min(1),
  S3_BUCKET_QUARANTINE: z.string().min(1).default("ota-quarantine"),
  S3_BUCKET_PUBLISHED: z.string().min(1).default("ota-published"),
  /** MinIO and path-style gateways need true; AWS virtual-hosted style uses false. */
  S3_FORCE_PATH_STYLE: z
    .enum(["true", "false"])
    .default("true")
    .transform((v) => v === "true"),
  OTA_MAX_PACKAGE_BYTES: z.coerce.number().int().positive().default(8_589_934_592),
  /** Multipart part size for browser uploads (MinIO minimum 5 MiB per part). */
  OTA_UPLOAD_PART_SIZE_BYTES: z.coerce.number().int().positive().default(64 * 1024 * 1024),
  /** Concurrent part uploads from the browser. */
  OTA_UPLOAD_PARALLEL_PARTS: z.coerce.number().int().positive().max(16).default(15),
  /** Files at or above this size use multipart; smaller files use a single PUT. */
  OTA_UPLOAD_MULTIPART_MIN_BYTES: z.coerce.number().int().positive().default(100 * 1024 * 1024),
  ROLLOUT_HASH_SECRET: z.string().min(32),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
  ACCESS_LOG_RETENTION_DAYS: z.coerce.number().int().positive().default(90),
  WORKER_CONCURRENCY: z.coerce.number().int().positive().default(2),
  PORT: z.coerce.number().int().positive().default(3000),
  METRICS_PORT: z.coerce.number().int().positive().default(9464),
});

export type AppEnv = z.infer<typeof envSchema>;

let cached: AppEnv | undefined;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): AppEnv {
  if (cached) return cached;
  loadRootEnv();
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`Invalid environment configuration:\n${details}`);
  }
  cached = parsed.data;
  return cached;
}

export function resetEnvCacheForTests(): void {
  cached = undefined;
}

export { loadRootEnv } from "./load-root-env.js";
export { envSchema };
