#!/usr/bin/env node
/**
 * Cross-platform pnpm launcher (no global pnpm required).
 * Usage: node scripts/run-pnpm.mjs install
 */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const localPnpm = join(root, "node_modules", "pnpm", "bin", "pnpm.cjs");
const args = process.argv.slice(2);

function runNodePnpm(pnpmPath, pnpmArgs) {
  const result = spawnSync(process.execPath, [pnpmPath, ...pnpmArgs], {
    stdio: "inherit",
    cwd: root,
    env: process.env,
  });
  process.exit(result.status ?? 1);
}

if (existsSync(localPnpm)) {
  runNodePnpm(localPnpm, args);
}

const npx = process.platform === "win32" ? "npx.cmd" : "npx";
const result = spawnSync(npx, ["--yes", "pnpm@9.15.4", ...args], {
  stdio: "inherit",
  cwd: root,
  env: process.env,
  shell: process.platform === "win32",
});

if (result.error) {
  console.error("pnpm not found. Run: npx pnpm@9.15.4 install");
  process.exit(1);
}

process.exit(result.status ?? 1);
