import withBundleAnalyzer from '@next/bundle-analyzer'

const bundleAnalyzer = withBundleAnalyzer({
  enabled: process.env.ANALYZE === 'true',
})

let userConfig = undefined
try {
  // Try to import user config if it exists
  userConfig = await import('./v0-user-next.config.js')
} catch (e) {
  // ignore error - file doesn't exist
}

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
  experimental: {
    optimizeCss: true,
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
    // Enable advanced tree shaking
    swcPlugins: [],
  },
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production',
  },
  poweredByHeader: false,
  compress: true,
  modularizeImports: {
    'date-fns': {
      transform: 'date-fns/{{member}}'
    }
  },
  webpack: (config, { dev, isServer }) => {
    // Only apply critical optimizations that don't break module resolution
    
    // Ensure consistent module IDs for better caching
    config.optimization.moduleIds = 'deterministic'
    
    // Add module resolution fallbacks to prevent Node.js module errors in browser
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      net: false,
      tls: false,
    }

    // Improve error handling for dynamic imports
    if (dev) {
      config.optimization = {
        ...config.optimization,
        removeAvailableModules: false,
        removeEmptyChunks: false,
      }
    }

    // Stricter performance hints for production optimization tracking
    if (!dev && !isServer) {
      config.performance = {
        hints: 'warning',
        maxAssetSize: 400000, // 400KB - strict limit for bundle size monitoring
        maxEntrypointSize: 400000, // 400KB - strict limit for entry point size
        assetFilter: (assetFilename) => {
          // Ignore source maps and fonts in performance calculations
          return !assetFilename.endsWith('.map') && !assetFilename.match(/\.(woff|woff2|eot|ttf|otf)$/)
        }
      }
      
      // Configure code splitting to enforce bundle size limits
      // Merge with Next.js defaults to preserve framework chunk and vendor splitting
      config.optimization.splitChunks = {
        ...config.optimization.splitChunks,
        chunks: 'all',
        cacheGroups: {
          ...config.optimization.splitChunks?.cacheGroups,
          // Separate large libraries into their own chunks with size limits
          firebase: {
            test: /[\\/]node_modules[\\/](firebase|@firebase)[\\/]/,
            name: 'firebase',
            priority: 10,
            chunks: 'all',
            maxSize: 200000,
          },
          recharts: {
            test: /[\\/]node_modules[\\/]recharts[\\/]/,
            name: 'recharts',
            priority: 10,
            chunks: 'all',
            maxSize: 200000,
          },
          framerMotion: {
            test: /[\\/]node_modules[\\/]framer-motion[\\/]/,
            name: 'framer-motion',
            priority: 10,
            chunks: 'all',
            maxSize: 200000,
          },
        },
      }
      
      // Enable tree shaking for production
      config.optimization.usedExports = true
    }

    return config
  },
  // Empty turbopack config to silence Next.js 16 warning
  // We're explicitly using webpack via --webpack flag in dev script
  turbopack: {},
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
            key: 'X-XSS-Protection',
            value: '1; mode=block',
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
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
    ]
  },
}

mergeConfig(nextConfig, userConfig)

function mergeConfig(nextConfig, userConfig) {
  if (!userConfig) {
    return
  }

  for (const key in userConfig) {
    if (
      typeof nextConfig[key] === 'object' &&
      !Array.isArray(nextConfig[key])
    ) {
      nextConfig[key] = {
        ...nextConfig[key],
        ...userConfig[key],
      }
    } else {
      nextConfig[key] = userConfig[key]
    }
  }
}

export default bundleAnalyzer(nextConfig)
