import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@gmail-agent/db"],
  serverExternalPackages: ["@prisma/client"],
};

export default nextConfig;
