import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // RHF's mutable form state must update field consumers without compiler caching.
  reactCompiler: false,
};

export default nextConfig;
