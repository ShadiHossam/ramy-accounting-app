import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {},
  output: "standalone",
  experimental: {
    cpus: process.env.NEXT_BUILD_CPUS
      ? Number(process.env.NEXT_BUILD_CPUS)
      : undefined,
  },
};

export default nextConfig;
