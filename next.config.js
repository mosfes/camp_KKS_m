/** @type {import('next').NextConfig} */
const projectRoot = __dirname;

const nextConfig = {
  eslint: {
    // Warning: This allows production builds to successfully complete even if
    // your project has ESLint errors.
    ignoreDuringBuilds: true,
  },
  images: {
    // Bypass Vercel's image optimizer (quota-limited on the free plan) and
    // let Cloudinary resize/compress via URL transformations instead.
    loader: "custom",
    loaderFile: "./lib/cloudinary-image-loader.ts",
    deviceSizes: [384, 480, 640, 750, 828, 1080, 1200, 1920],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
      },
    ],
  },
  // Keep file watching and output tracing scoped to this project. A stray
  // package-lock.json in the parent home directory must not become the root.
  outputFileTracingRoot: projectRoot,
  turbopack: {
    root: projectRoot,
  },
  // Keep Prisma Client working in serverless environments
  serverExternalPackages: ["@prisma/client"],
  async headers() {
    return [
      {
        source: "/notification-sw.js",
        headers: [
          {
            key: "Content-Type",
            value: "application/javascript; charset=utf-8",
          },
          {
            key: "Cache-Control",
            value: "no-cache, no-store, must-revalidate",
          },
          {
            key: "Content-Security-Policy",
            value: "default-src 'self'; script-src 'self'",
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
