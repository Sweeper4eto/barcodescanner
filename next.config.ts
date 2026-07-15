import type { NextConfig } from "next";

const allowedDevOrigins =
  process.env.ALLOWED_DEV_ORIGINS?.split(",")
    .map((origin) => origin.trim())
    .filter(Boolean) ?? ["127.0.0.1", "localhost"];

const nextConfig: NextConfig = {
  reactCompiler: true,
  allowedDevOrigins,
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.experiments = {
        ...config.experiments,
        asyncWebAssembly: true,
      };
    }
    return config;
  },
};

export default nextConfig;
