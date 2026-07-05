import type { NextConfig } from "next";

const allowedDevOrigins =
  process.env.ALLOWED_DEV_ORIGINS?.split(",")
    .map((origin) => origin.trim())
    .filter(Boolean) ?? ["127.0.0.1", "localhost"];

const nextConfig: NextConfig = {
  reactCompiler: true,
  allowedDevOrigins,
};

export default nextConfig;
