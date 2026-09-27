import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // RHF's mutable form state must update field consumers without compiler caching.
  reactCompiler: false,
  // Public API serves company/apartment imagery from ImageKit.
  images: {
    remotePatterns: [{ protocol: 'https', hostname: 'ik.imagekit.io', pathname: '/**' }],
  },
};

export default nextConfig;
