import type React from "react"
import type { Metadata, Viewport } from "next"
import "./globals.css"
import { Suspense, lazy } from 'react'
import { LoadingSpinner } from "../components/ui/loading-spinner"
import { ErrorBoundary } from "../components/error-boundary"
import FontLoader from "../components/font-loader"

// Lazy load providers to reduce initial bundle size
const ThemeProvider = lazy(() => import("../components/theme-provider").then(mod => ({ default: mod.ThemeProvider })))
const AuthProvider = lazy(() => import("../contexts/auth-context").then(mod => ({ default: mod.AuthProvider })))
const Toaster = lazy(() => import("../components/ui/toaster").then(mod => ({ default: mod.Toaster })))
const TooltipProvider = lazy(() => import("../components/ui/tooltip").then(mod => ({ default: mod.TooltipProvider })))
const ReactQueryClientProvider = lazy(() => import("../lib/react-query-provider").then(mod => ({ default: mod.ReactQueryClientProvider })))
const AppInitializer = lazy(() => import("../components/app-initializer").then(mod => ({ default: mod.AppInitializer })))
const PerformanceMonitor = lazy(() => import("../components/performance-monitor").then(mod => ({ default: mod.PerformanceMonitor })))

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#000000',
}

export const metadata: Metadata = {
  title: "Sokin",
  description: "Personal finance",
  generator: 'sokin',
  manifest: '/manifest.json',
  icons: {
    icon: '/sokin-icon.png',
    apple: '/sokin-icon.png',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Optimized font loading with preconnect and preload */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&family=Roboto+Mono:wght@400;500&display=swap"
          rel="stylesheet"
          media="print"
        />
        <link rel="dns-prefetch" href={process.env.NEXT_PUBLIC_API_URL} />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />

        {/* Preload critical resources */}
        <link rel="preload" href="/sokin-icon.png" as="image" />
      </head>
      <body className="bg-dark text-cream antialiased">
        <FontLoader />
        <ErrorBoundary>
          <Suspense fallback={<LoadingSpinner size="lg" />}>
            <ReactQueryClientProvider>
              <Suspense fallback={<LoadingSpinner size="lg" />}>
                <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false} disableTransitionOnChange>
                  <Suspense fallback={<LoadingSpinner size="lg" />}>
                    <AuthProvider>
                      <Suspense fallback={<LoadingSpinner size="lg" />}>
                        <TooltipProvider>
                          <Suspense fallback={<LoadingSpinner size="lg" />}>
                            <AppInitializer />
                          </Suspense>
                          <Suspense fallback={<LoadingSpinner size="lg" />}>
                            {children}
                          </Suspense>
                          <Suspense fallback={null}>
                            <Toaster />
                          </Suspense>
                          <Suspense fallback={null}>
                            <PerformanceMonitor />
                          </Suspense>
                        </TooltipProvider>
                      </Suspense>
                    </AuthProvider>
                  </Suspense>
                </ThemeProvider>
              </Suspense>
            </ReactQueryClientProvider>
          </Suspense>
        </ErrorBoundary>
      </body>
    </html>
  )
}