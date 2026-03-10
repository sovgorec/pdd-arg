import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  async rewrites() {
    return [{ source: "/images/:path*", destination: "/api/image/:path*" }];
  },
};

export default nextConfig;
