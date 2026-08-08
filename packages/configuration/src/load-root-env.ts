import { config } from "dotenv";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";

let loaded = false;

function findMonorepoRoot(): string | undefined {
  let dir = process.cwd();
  for (let i = 0; i < 12; i++) {
    if (existsSync(join(dir, "pnpm-workspace.yaml")) && existsSync(join(dir, ".env"))) {
      return dir;
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return undefined;
}

/** Load root `.env` when vars are not already set (e.g. local dev from app subdirs). */
export function loadRootEnv(): void {
  if (loaded) return;
  loaded = true;

  const root = findMonorepoRoot();
  if (!root) return;

  config({ path: join(root, ".env") });
}
