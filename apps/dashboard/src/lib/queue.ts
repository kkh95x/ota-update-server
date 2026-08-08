import { Queue } from "bullmq";
import { Redis } from "ioredis";
import { loadEnv } from "@custom-os-ota/configuration";

let validationQueue: Queue | undefined;
let publishQueue: Queue | undefined;
let connection: Redis | undefined;

function getConnection(): Redis {
  if (!connection) {
    const env = loadEnv();
    connection = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });
  }
  return connection;
}

export function getValidationQueue(): Queue {
  if (!validationQueue) {
    validationQueue = new Queue("ota-validation", { connection: getConnection() });
  }
  return validationQueue;
}

export function getPublishQueue(): Queue {
  if (!publishQueue) {
    publishQueue = new Queue("ota-publish", { connection: getConnection() });
  }
  return publishQueue;
}

export type ValidationJobPayload = {
  validationJobId: string;
  uploadSessionId: string;
};

export type PublishJobPayload = {
  releaseId: string;
};

export async function enqueueValidationJob(payload: ValidationJobPayload): Promise<void> {
  await getValidationQueue().add("validate-ota", payload, {
    jobId: payload.validationJobId,
    removeOnComplete: 100,
    removeOnFail: 200,
  });
}

export async function enqueuePublishJob(payload: PublishJobPayload): Promise<void> {
  await getPublishQueue().add("publish-ota", payload, {
    jobId: `publish-${payload.releaseId}`,
    removeOnComplete: 100,
    removeOnFail: 200,
  });
}
