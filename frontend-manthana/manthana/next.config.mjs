/** @type {import('next').NextConfig} */
const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const apiOrigin = apiUrl.replace(/\/$/, "");

// Parse API URL for images + CSP (fallback to localhost:8000)
let apiHost = "localhost";
let apiProtocol = "http";
let apiPort = "8000";
try {
  const u = new URL(apiOrigin);
  apiHost = u.hostname;
  apiProtocol = u.protocol.replace(":", "");
  apiPort = u.port || (apiProtocol === "https" ? "443" : "80");
} catch {
  /* keep defaults */
}

/**
 * Build list of allowed connect-src origins including all microservices.
 * Falls back to the main API URL if section-specific URLs are not set.
 */
function buildConnectOrigins() {
  const origins = new Set();

  // Add unified API
  const unified = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
  origins.add(unified.replace(/\/$/, ""));

  // Add section-specific microservices with their default ports
  const sectionUrls = [
    process.env.NEXT_PUBLIC_ORACLE_API_URL ?? "http://localhost:8100",
    process.env.NEXT_PUBLIC_WEB_API_URL ?? "http://localhost:8200",
    process.env.NEXT_PUBLIC_RESEARCH_API_URL ?? "http://localhost:8201",
    process.env.NEXT_PUBLIC_ANALYSIS_API_URL ?? "http://localhost:8202",
    process.env.NEXT_PUBLIC_CLINICAL_API_URL,
  ];

  for (const url of sectionUrls) {
    if (url) origins.add(url.replace(/\/$/, ""));
  }

  // Convert to array and generate WebSocket variants
  const httpOrigins = Array.from(origins);
  const wsOrigins = httpOrigins.map((o) =>
    o.replace(/^https?:/, (m) => (m === "https:" ? "wss:" : "ws:"))
  );

  return [...httpOrigins, ...wsOrigins].join(" ");
}

const connectOrigins = buildConnectOrigins();

const nextConfig = {
  eslint: { ignoreDuringBuilds: true },
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
    const backendUrl =
      process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
    return [
      // 1. Auth stays local — handled by Next.js API route
      { source: "/api/auth/:path*", destination: "/api/auth/:path*" },
      // 2. All other /api/* → backend (search, chat, etc.)
      { source: "/api/:path*", destination: `${backendUrl}/:path*` },
    ];
  },

  // Security headers
  async headers() {
    return [
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
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://fonts.gstatic.com",
              "font-src 'self' https://fonts.gstatic.com data:",
              `img-src 'self' data: blob: ${apiOrigin} https:`,
              `connect-src 'self' ${connectOrigins}`,
              "media-src 'self' blob:",
              // In-app /viewer iframe loads third-party result pages (user-chosen URLs)
              "frame-src 'self' https: http:",
            ].join("; "),
          },
        ],
      },
    ];
  },

  // Webpack: handle DICOM files
  webpack(config) {
    config.module.rules.push({
      test: /\.dcm$/,
      use: "file-loader",
    });
    return config;
  },
};

export default nextConfig;
