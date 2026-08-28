import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@watchparty/shared"],
  devIndicators: false,
};

export default nextConfig;
