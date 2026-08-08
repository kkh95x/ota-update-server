import { loadEnv } from "@custom-os-ota/configuration";

let envLoaded = false;

export function ensureEnv(): void {
  if (!envLoaded) {
    loadEnv();
    envLoaded = true;
  }
}
