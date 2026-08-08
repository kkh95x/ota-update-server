import { Redis } from "ioredis";
import { loadEnv } from "@custom-os-ota/configuration";

let redis: Redis | undefined;

export function getRedis(): Redis {
  if (!redis) {
    const env = loadEnv();
    redis = new Redis(env.REDIS_URL, { maxRetriesPerRequest: 1, lazyConnect: true });
  }
  return redis;
}

export async function checkRedisHealth(): Promise<boolean> {
  try {
    const client = getRedis();
    if (client.status !== "ready") await client.connect();
    const pong = await client.ping();
    return pong === "PONG";
  } catch {
    return false;
  }
}
