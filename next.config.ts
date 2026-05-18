import type { NextConfig } from "next";

// Injected at build time so the badge always shows the correct deploy date
// without any manual version bumping.
const buildDate = new Date().toISOString().slice(0, 10).replace(/-/g, ""); // e.g. "20260517"

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_BUILD_DATE: buildDate,
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com"
      },
      {
        protocol: "https",
        hostname: "api.qrserver.com"
      }
    ]
  }
};

export default nextConfig;
