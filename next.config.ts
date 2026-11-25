import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["qrcode"],
  images: {
    remotePatterns: [{ protocol: "https", hostname: "**" }],
  },
};

export default nextConfig;
