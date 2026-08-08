#!/usr/bin/env node
/**
 * Load root .env then run a command (avoids Python `dotenv` CLI conflict on Windows).
 * Usage: node scripts/with-root-env.mjs prisma db push
 */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const envPath = join(root, ".env");

if (!existsSync(envPath)) {
  console.error(`Missing ${envPath}. Run: npm run generate-env`);
  process.exit(1);
}

// Root .env must win over stale shell exports (common on VPS / CI).
config({ path: envPath, override: true });

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error("Usage: node scripts/with-root-env.mjs <command> [args...]");
  process.exit(1);
}

const [command, ...commandArgs] = args;
const result = spawnSync(command, commandArgs, {
  stdio: "inherit",
  env: process.env,
  shell: process.platform === "win32",
});

process.exit(result.status ?? 1);
