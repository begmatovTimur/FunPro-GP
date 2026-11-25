import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    agentFeedback: true,
  },
  cacheComponents: true,
  partialPrefetching: true,
  // Lets other PCs open the dev server (`npm run dev`) by this laptop's IP address.
  // 26.*.*.* = Radmin VPN addresses (e.g. 26.162.208.170).
  allowedDevOrigins: ["26.162.208.170", "26.*.*.*", "192.168.*.*", "10.*.*.*", "172.*.*.*", "*.local"],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
