/**
 * Next 16 builds with Turbopack, so this config carries no webpack block:
 * the previous splitChunks/performance tuning never ran and only made dev
 * (which had been pinned to --webpack) diverge from what shipped.
 */

const isDev = process.env.NODE_ENV !== 'production'

/**
 * Returns the origin of a configured URL, or null when the variable is unset
 * or unparseable. Used to build connect-src from the same values the app
 * actually calls at runtime, so the policy cannot drift from the deployment.
 */
const originOf = (value) => {
  if (!value) return null
  try {
    return new URL(value).origin
  } catch {
    return null
  }
}

const apiOrigin = originOf(process.env.NEXT_PUBLIC_API_URL)
const sentryOrigin = originOf(process.env.NEXT_PUBLIC_SENTRY_DSN)

/**
 * A real deploy must not ship a policy that omits its own API.
 *
 * connect-src is assembled from build-time values, so a production build
 * without NEXT_PUBLIC_API_URL would emit a policy that blocks every request
 * the app makes - and it would surface as unexplained CSP errors in the
 * browser rather than as the missing configuration it actually is.
 *
 * Keyed on VERCEL_ENV rather than NODE_ENV on purpose: CI builds with
 * NODE_ENV=production as a smoke test and deliberately has no runtime
 * configuration, and that build must keep working. VERCEL_ENV is set only
 * where the output is actually served.
 */
if (process.env.VERCEL_ENV === 'production' && !apiOrigin) {
  throw new Error(
    'NEXT_PUBLIC_API_URL is required for a production deploy: without it the ' +
    'Content-Security-Policy omits the API origin and blocks every request.'
  )
}
const firebaseAuthDomain = process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
  ? `https://${process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN}`
  : null

/**
 * Content-Security-Policy.
 *
 * 'unsafe-inline' is present on script-src because Next streams the RSC
 * payload through inline <script> tags, and this app has no proxy/middleware
 * layer to mint a per-request nonce and thread it into them - dropping
 * 'unsafe-inline' without building that first blanks every page. The policy
 * still buys the things that matter most here: no third-party script origin
 * can be loaded, no <base> can be injected to re-point relative URLs, forms
 * cannot post credentials off-origin, and the app cannot be framed.
 *
 * connect-src is an allowlist rather than https: because this app's XHR
 * surface is exactly the backend API, Firebase Auth/Installations and Sentry -
 * an exfiltration channel to an attacker-controlled host is the payload an
 * injected script would want most.
 */
const contentSecurityPolicy = [
  "default-src 'self'",
  // gstatic serves the firebase-messaging service worker's importScripts()
  [
    "script-src 'self' 'unsafe-inline' https://www.gstatic.com",
    // React Refresh compiles with eval in dev; the production bundle does not.
    isDev ? "'unsafe-eval'" : '',
  ].filter(Boolean).join(' '),
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://firebasestorage.googleapis.com https://*.firebasestorage.app",
  "font-src 'self' data:",
  [
    "connect-src 'self'",
    'https://identitytoolkit.googleapis.com',
    'https://securetoken.googleapis.com',
    'https://firebaseinstallations.googleapis.com',
    'https://fcmregistrations.googleapis.com',
    'https://firebasestorage.googleapis.com',
    'https://*.firebasestorage.app',
    'https://www.googleapis.com',
    apiOrigin,
    sentryOrigin,
    // Turbopack HMR talks to the dev server over a websocket.
    isDev ? 'ws: wss:' : '',
  ].filter(Boolean).join(' '),
  ["frame-src 'self'", firebaseAuthDomain].filter(Boolean).join(' '),
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "media-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  ...(isDev ? [] : ['upgrade-insecure-requests']),
].join('; ')

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'firebasestorage.googleapis.com',
        port: '',
        pathname: '**',
      },
    ],
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 31536000, // 1 year
  },
  turbopack: {},
  experimental: {
    scrollRestoration: true,
    optimizePackageImports: [
      '@radix-ui/react-icons',
      'lucide-react',
      'date-fns',
      '@radix-ui/react-dialog',
      '@radix-ui/react-dropdown-menu',
      '@radix-ui/react-select',
      'recharts',
      'firebase',
      'framer-motion'
    ],
  },
  compiler: {
    // Keep error/warn: the logger forwards them to Sentry and stripping
    // them left production with no telemetry at all.
    removeConsole: process.env.NODE_ENV === 'production' ? { exclude: ['error', 'warn'] } : false,
  },
  poweredByHeader: false,
  compress: true,
  headers: async () => {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on',
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'origin-when-cross-origin',
          },
          {
            key: 'Content-Security-Policy',
            value: contentSecurityPolicy,
          },
          {
            // The app never asks for any of these, so denying them outright
            // means an injected script cannot ask on the user's behalf either.
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), midi=(), magnetometer=(), gyroscope=(), accelerometer=(), display-capture=()',
          },
        ],
      },
      // Production only. Turbopack's dev chunk URLs are stable across rebuilds,
      // so an immutable year-long max-age tells the browser to keep serving the
      // first bundle it ever saw - edits then appear to have no effect no matter
      // how many times the dev server restarts.
      ...(process.env.NODE_ENV === 'production'
        ? [
            {
              source: '/_next/static/:path*',
              headers: [
                {
                  key: 'Cache-Control',
                  value: 'public, max-age=31536000, immutable',
                },
              ],
            },
          ]
        : []),
    ]
  },
}

export default nextConfig
