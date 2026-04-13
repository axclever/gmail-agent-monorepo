import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@gmail-agent/db", "@gmail-agent/rule-conditions"],
  serverExternalPackages: ["@prisma/client"],
};

export default nextConfig;
