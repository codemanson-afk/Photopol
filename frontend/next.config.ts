import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  allowedDevOrigins: [
    "awaited-griffon-rapidly.ngrok-free.app",
    "*.ngrok-free.app",
    "*.ngrok.io",
  ],
  devIndicators: {
    position: "bottom-right",
  },
  images: {
    remotePatterns: [
      { protocol: "http", hostname: "localhost", port: "9000", pathname: "/**" },
      { protocol: "http", hostname: "127.0.0.1", port: "8000", pathname: "/**" },
      { protocol: "https", hostname: "**.photopol.us", pathname: "/**" },
      { protocol: "https", hostname: "**.ngrok-free.app", pathname: "/**" },
    ],
  },
  async rewrites() {
    const api = process.env.BACKEND_URL || "http://127.0.0.1:8000";
    return [
      { source: "/api/:path*", destination: `${api}/api/:path*` },
      { source: "/media/:path*", destination: `${api}/media/:path*` },
    ];
  },
};

export default nextConfig;
