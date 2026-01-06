import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // Increase API route timeout and body size limits
  experimental: {
    serverActions: {
      bodySizeLimit: '50mb',
    },
  },
};

export default nextConfig;
