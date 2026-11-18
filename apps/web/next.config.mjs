import { fileURLToPath } from "node:url";

/** @type {import("next").NextConfig} */
const nextConfig = {
  experimental: {
    turbopackPluginRuntimeStrategy: "workerThreads",
  },
  turbopack: {
    root: fileURLToPath(new URL("../../", import.meta.url)),
  },
};

export default nextConfig;
