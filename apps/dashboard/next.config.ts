import type { NextConfig } from "next";
import { loadRootEnv } from "@custom-os-ota/configuration";

loadRootEnv();

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["@node-rs/argon2", "@prisma/client", "@aws-sdk/client-s3"],
  transpilePackages: [
    "@custom-os-ota/configuration",
    "@custom-os-ota/shared",
    "@custom-os-ota/observability",
    "@custom-os-ota/database",
    "@custom-os-ota/audit",
    "@custom-os-ota/authorization",
    "@custom-os-ota/auth",
    "@custom-os-ota/object-storage",
  ],
};

export default nextConfig;
