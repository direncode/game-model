/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      {
        source: "/api/v1/:path*",
        destination: `${process.env.NEXT_PUBLIC_CONTROL_PLANE_URL || "http://localhost:8001"}/api/v1/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
