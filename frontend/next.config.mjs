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
      '@radix-ui/react-select'
    ],
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
    // Optimize bundle splitting for better caching
    config.optimization.splitChunks = {
      chunks: 'all',
      cacheGroups: {
        framework: {
          chunks: 'all',
          name: 'framework',
          test: /(?<!node_modules.*)[\\/]node_modules[\\/](react|react-dom|scheduler|prop-types|use-subscription)[\\/]/,
          priority: 40,
          enforce: true,
        },
        lib: {
          test: /[\\/]node_modules[\\/](!next[\\/])[\\/]/,
          name: 'lib',
          priority: 30,
          chunks: 'all',
        },
        radix: {
          test: /[\\/]node_modules[\\/]@radix-ui[\\/]/,
          name: 'radix',
          chunks: 'all',
          priority: 20,
        },
        recharts: {
          test: /[\\/]node_modules[\\/]recharts[\\/]/,
          name: 'recharts',
          chunks: 'all',
          priority: 15,
        },
        firebase: {
          test: /[\\/]node_modules[\\/]firebase[\\/]/,
          name: 'firebase',
          chunks: 'all',
          priority: 15,
        },
        three: {
          test: /[\\/]node_modules[\\/](three|@react-three)[\\/]/,
          name: 'three',
          chunks: 'all',
          priority: 10,
        },
        framerMotion: {
          test: /[\\/]node_modules[\\/]framer-motion[\\/]/,
          name: 'framer-motion',
          chunks: 'all',
          priority: 10,
        },
        // Separate chunk for large utilities
        utils: {
          test: /[\\/]node_modules[\\/](clsx|tailwind-merge|date-fns|sonner)[\\/]/,
          name: 'utils',
          chunks: 'all',
          priority: 5,
        },
      },
    }

    // Add performance hints in production
    if (!dev && !isServer) {
      config.performance = {
        hints: 'warning',
        maxAssetSize: 512000, // 512KB
        maxEntrypointSize: 512000, // 512KB
      }
    }

    // Optimize CSS extraction
    if (!isServer) {
      config.optimization = {
        ...config.optimization,
        runtimeChunk: 'single',
        splitChunks: config.optimization.splitChunks,
      }
    }

    return config
  },
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
