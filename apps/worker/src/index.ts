import { createServer } from "node:http";
import { Redis } from "ioredis";
import { loadEnv } from "@custom-os-ota/configuration";
import { checkDatabaseHealth } from "@custom-os-ota/database";
import { createLogger } from "@custom-os-ota/observability";
import { startValidationWorker } from "./validation.js";
import { startPublishWorker } from "./publish.js";

const log = createLogger("worker");

async function main() {
  const env = loadEnv();
  const connection = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });

  const validationWorker = startValidationWorker(connection, env.WORKER_CONCURRENCY);
  const publishWorker = startPublishWorker(connection, env.WORKER_CONCURRENCY);

  const metricsServer = createServer(async (req, res) => {
    if (req.url === "/health/live") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "live" }));
      return;
    }
    if (req.url === "/health/ready") {
      const dbOk = await checkDatabaseHealth();
      const redisOk = (await connection.ping()) === "PONG";
      const status = dbOk && redisOk ? 200 : 503;
      res.writeHead(status, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: dbOk && redisOk ? "ready" : "degraded", database: dbOk, redis: redisOk }));
      return;
    }
    if (req.url === "/metrics") {
      res.writeHead(200, { "Content-Type": "text/plain" });
      res.end("# worker metrics placeholder\n");
      return;
    }
    res.writeHead(404);
    res.end();
  });

  metricsServer.listen(env.METRICS_PORT, () => {
    log.info("worker.started", {
      event: "worker.started",
      metadata: { metricsPort: env.METRICS_PORT, concurrency: env.WORKER_CONCURRENCY },
    });
  });

  const shutdown = async () => {
    log.info("worker.shutdown", { event: "worker.shutdown" });
    await validationWorker.close();
    await publishWorker.close();
    await connection.quit();
    metricsServer.close();
    process.exit(0);
  };

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

main().catch((err) => {
  log.fatal("worker.crash", { event: "worker.crash", metadata: { error: String(err) } });
  process.exit(1);
});
