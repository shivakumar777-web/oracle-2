/** @type {import('next').NextConfig} */
/** Oracle is proxied by App Route `src/app/api/oracle-backend/[[...path]]/route.ts` (reliable SSE). ORACLE_INTERNAL_URL is read there. */

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const apiOrigin = apiUrl.startsWith("/")
  ? ""
  : apiUrl.replace(/\/$/, "");

// Parse API URL for images + CSP (fallback to localhost:8000)
let apiHost = "localhost";
let apiProtocol = "http";
let apiPort = "8000";
try {
  if (apiOrigin) {
    const u = new URL(apiOrigin);
    apiHost = u.hostname;
    apiProtocol = u.protocol.replace(":", "");
    apiPort = u.port || (apiProtocol === "https" ? "443" : "80");
  }
} catch {
  /* keep defaults */
}

/**
 * Build list of allowed connect-src origins including all microservices.
 * Falls back to the main API URL if section-specific URLs are not set.
 */
function buildConnectOrigins() {
  const origins = new Set();

  const addAbs = (url) => {
    if (!url || typeof url !== "string") return;
    const u = url.replace(/\/$/, "");
    if (u.startsWith("http://") || u.startsWith("https://")) origins.add(u);
  };

  addAbs(process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000");
  addAbs(process.env.NEXT_PUBLIC_ORACLE_API_URL ?? "http://localhost:8100");
  addAbs(process.env.NEXT_PUBLIC_WEB_API_URL ?? "http://localhost:8200");
  addAbs(process.env.NEXT_PUBLIC_RESEARCH_API_URL ?? "http://localhost:8201");
  addAbs(process.env.NEXT_PUBLIC_ANALYSIS_API_URL ?? "http://localhost:8202");
  addAbs(process.env.NEXT_PUBLIC_CLINICAL_API_URL);
  addAbs(process.env.NEXT_PUBLIC_SUPABASE_URL);

  const httpOrigins = Array.from(origins);
  const wsOrigins = httpOrigins.map((o) =>
    o.replace(/^https?:/, (m) => (m === "https:" ? "wss:" : "ws:"))
  );

  return [...httpOrigins, ...wsOrigins].join(" ");
}

const connectOrigins = buildConnectOrigins();

const nextConfig = {
  reactStrictMode: true,
  eslint: { ignoreDuringBuilds: true },
  transpilePackages: [
    "@cornerstonejs/core",
    "@cornerstonejs/tools",
    "@cornerstonejs/dicom-image-loader",
    "@cornerstonejs/codec-charls",
    "@cornerstonejs/codec-libjpeg-turbo-8bit",
    "@cornerstonejs/codec-openjpeg",
    "@cornerstonejs/codec-openjph",
  ],
  // Allow images from backend and medical image sources
  images: {
    remotePatterns: [
      { protocol: apiProtocol, hostname: apiHost, port: apiPort },
      { protocol: "https", hostname: "**.pubmed.ncbi.nlm.nih.gov" },
      { protocol: "https", hostname: "**.who.int" },
    ],
  },

  // API proxy rewrites: /api/auth/* stays local; /api/* → backend
  async rewrites() {
    const backendUrl = (
      process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"
    ).replace(/\/$/, "");
    return [
      // Browsers request /favicon.ico by default; manifest referenced it but file was missing.
      { source: "/favicon.ico", destination: "/icons/icon.svg" },
      // 1. Auth stays local — handled by Next.js API route
      { source: "/api/auth/:path*", destination: "/api/auth/:path*" },
      // 2. Oracle: handled by app/api/oracle-backend/[[...path]]/route.ts (do not rewrite here — breaks SSE).
      // 3. Relative API base is a proxy path — avoid broken self-rewrite
      ...(backendUrl.startsWith("/")
        ? []
        : [{ source: "/api/:path*", destination: `${backendUrl}/:path*` }]),
    ];
  },

  // Security headers
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          {
            key: "Cache-Control",
            value: "no-cache, no-store, must-revalidate",
          },
        ],
      },
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(self), geolocation=()",
          },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              // FastAPI /docs (proxied at /api/oracle-backend/docs) loads Swagger UI from jsDelivr
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://fonts.gstatic.com https://cdn.jsdelivr.net",
              "font-src 'self' https://fonts.gstatic.com data:",
              `img-src 'self' data: blob: ${apiOrigin} https:`,
              // SW fetch() + Swagger UI may request jsDelivr; connect-src governs fetch(), not script-src alone
              `connect-src 'self' ${connectOrigins} https://cdn.jsdelivr.net`,
              "media-src 'self' blob:",
              // In-app /viewer iframe loads third-party result pages (user-chosen URLs)
              "frame-src 'self' https: http:",
            ].join("; "),
          },
        ],
      },
    ];
  },

  // Webpack: DICOM assets + Cornerstone3D browser bundle
  webpack(config, { isServer }) {
    config.module.rules.push({
      test: /\.dcm$/,
      use: "file-loader",
    });

    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
      };
      config.resolve.conditionNames = [
        "import",
        "module",
        "browser",
        "default",
      ];
    }

    config.resolve.extensionAlias = {
      ...config.resolve.extensionAlias,
      ".js": [".ts", ".tsx", ".js", ".jsx"],
    };

    return config;
  },
};

export default nextConfig;
