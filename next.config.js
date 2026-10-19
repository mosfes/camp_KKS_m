/** @type {import('next').NextConfig} */
const projectRoot = __dirname;

// Clerk encodes its public frontend API host in the publishable key. Use the
// active instance so the same policy works with test and production keys.
const encodedClerkHost = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.match(
  /^pk_(?:test|live)_(.+)$/,
)?.[1];
const decodedClerkHost = encodedClerkHost
  ? Buffer.from(encodedClerkHost, "base64").toString("utf8").replace(/\$$/, "")
  : "";
const clerkFrontendApi = /^[a-z0-9.-]+$/i.test(decodedClerkHost)
  ? `https://${decodedClerkHost}`
  : "https://clerk.kkscamp.com";
const developmentConnections =
  process.env.NODE_ENV === "development"
    ? " http://localhost:* ws://localhost:*"
    : "";

// Keep this policy compatible with Clerk's hosted sign-in UI and the Google
// Maps JavaScript API. Both providers create scripts/styles at runtime.
const contentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'self'",
  `form-action 'self' ${clerkFrontendApi}`,
  `script-src 'self' 'unsafe-inline' 'unsafe-eval' blob: ${clerkFrontendApi} https://challenges.cloudflare.com https://*.protect.clerk.com https://*.googleapis.com https://*.gstatic.com https://*.google.com https://*.ggpht.com https://*.googleusercontent.com`,
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "img-src 'self' data: blob: https://res.cloudinary.com https://img.clerk.com https://*.googleapis.com https://*.gstatic.com https://*.google.com https://*.googleusercontent.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  `connect-src 'self' data: blob: ${clerkFrontendApi} https://*.protect.clerk.com:* https://clerk-telemetry.com https://*.clerk-telemetry.com https://api.cloudinary.com https://*.googleapis.com https://*.gstatic.com https://*.google.com${developmentConnections}`,
  "frame-src 'self' https://challenges.cloudflare.com https://*.protect.clerk.com https://www.youtube.com https://player.vimeo.com https://drive.google.com https://*.google.com",
  "worker-src 'self' blob:",
  "media-src 'self' blob: https://res.cloudinary.com",
  "manifest-src 'self'",
].join("; ");

const nextConfig = {
  // Let security verification build beside a running local dev server.
  distDir: process.env.KKS_NEXT_DIST_DIR || ".next",
  poweredByHeader: false,
  eslint: {
    // Warning: This allows production builds to successfully complete even if
    // your project has ESLint errors.
    ignoreDuringBuilds: true,
  },
  images: {
    // Use Next.js/Vercel Image Optimization for responsive Cloudinary images.
    // A long TTL keeps repeat transformations and Vercel image usage low.
    deviceSizes: [384, 480, 640, 750, 828, 1080, 1200, 1920],
    minimumCacheTTL: 60 * 60 * 24 * 30,
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
  // Render metadata in <head> for every user agent instead of streaming it
  // into <body>, so crawlers and Lighthouse always see the description.
  htmlLimitedBots: /.*/,
  // Keep Prisma Client working in serverless environments
  serverExternalPackages: ["@prisma/client"],
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: contentSecurityPolicy },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Access-Control-Allow-Origin",
            value: "https://www.kkscamp.com",
          },
        ],
      },
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
