import type { NextConfig } from "next";

const fromEnv =
  process.env.ALLOWED_DEV_ORIGINS?.split(",")
    .map((origin) => origin.trim())
    .filter(Boolean) ?? [];

// Phone LAN testing needs the LAN IP; without it, Next can block /_next assets
// and you get a white screen after login.
const nextConfig: NextConfig = {
  reactCompiler: true,
  allowedDevOrigins: [
    "127.0.0.1",
    "localhost",
    "192.168.1.211",
    ...fromEnv,
  ],
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
