import { fileURLToPath } from "node:url";

/** @type {import("next").NextConfig} */
const nextConfig = {
  allowedDevOrigins: process.env.NODE_ENV === "development"
    ? ["localhost", ...(process.env.DEV_WEB_ORIGINS ?? "").split(",").map(value => value.trim()).filter(Boolean).map(value => {
      const origin = new URL(value);
      if (origin.origin !== value || origin.hostname.includes("*") || !["http:", "https:"].includes(origin.protocol)) throw new Error("DEV_WEB_ORIGINS exige origens exatas, sem wildcard.");
      return origin.hostname;
    })]
    : undefined,
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  typescript: {
    tsconfigPath: process.env.NEXT_DIST_DIR === ".next-e2e" ? "tsconfig.e2e.json" : "tsconfig.json",
  },
  async rewrites() {
    return [{ source: "/api/v1/:path*", destination: `${process.env.API_INTERNAL_URL ?? "http://127.0.0.1:3001"}/api/v1/:path*` }];
  },
  experimental: {
    turbopackPluginRuntimeStrategy: "workerThreads",
  },
  turbopack: {
    root: fileURLToPath(new URL("../../", import.meta.url)),
  },
};

export default nextConfig;
