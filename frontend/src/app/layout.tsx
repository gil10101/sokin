import type React from "react"
import type { Metadata, Viewport } from "next"
import { Outfit, Roboto_Mono } from "next/font/google"
import "./globals.css"
import { Suspense, lazy } from 'react'
import { ErrorBoundary } from "@/components/error-boundary"
import { ThemeProvider } from "@/components/theme-provider"
import { AuthProvider } from "@/contexts/auth-context"
import { NotificationsProvider } from "@/contexts/notifications-context"
import { Toaster } from "@/components/ui/toaster"
import { TooltipProvider } from "@/components/ui/tooltip"
import { ReactQueryClientProvider } from "@/lib/react-query-provider"

// Only lazy-load non-critical components
const AppInitializer = lazy(() => import("@/components/app-initializer").then(mod => ({ default: mod.AppInitializer })))
const PerformanceMonitor = lazy(() => import("@/components/performance-monitor").then(mod => ({ default: mod.PerformanceMonitor })))

const outfit = Outfit({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-outfit",
  display: "swap",
})

const robotoMono = Roboto_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-roboto-mono",
  display: "swap",
})

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#1A1A1A',
}

const APP_DESCRIPTION = "Personal finance, redefined. Track expenses, budgets, goals, net worth, bills, and your stock portfolio in one place."

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://sokin-frontend.vercel.app"),
  title: "Sokin",
  description: APP_DESCRIPTION,
  manifest: '/manifest.json',
  // The `?v=2` is a cache-buster, not decoration. Browsers cache a favicon far
  // more aggressively than a page asset and will keep serving a stale one for
  // days; the previous icons were broken for exactly that long, so shipping
  // corrected files at the same URLs would not have reached anyone who had
  // already loaded the site. Bump it whenever the icons are regenerated.
  icons: {
    icon: [
      { url: '/favicon.png?v=2', sizes: '32x32', type: 'image/png' },
      { url: '/icon-192.png?v=2', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512.png?v=2', sizes: '512x512', type: 'image/png' },
    ],
    apple: '/apple-touch-icon.png?v=2',
  },
  openGraph: {
    title: "Sokin",
    description: APP_DESCRIPTION,
    siteName: "Sokin",
    type: "website",
    images: ["/icon-512.png"],
  },
  twitter: {
    card: "summary",
    title: "Sokin",
    description: APP_DESCRIPTION,
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning className={`${outfit.variable} ${robotoMono.variable}`}>
      <head>
        {process.env.NEXT_PUBLIC_API_URL ? (
          <link rel="dns-prefetch" href={process.env.NEXT_PUBLIC_API_URL} />
        ) : null}
        {/* Preload critical resources */}
        <link rel="preload" href="/sokin-icon.png" as="image" />
      </head>
      <body className="bg-dark text-cream antialiased">
        <ErrorBoundary>
          <ReactQueryClientProvider>
            <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false} disableTransitionOnChange>
              <AuthProvider>
                <NotificationsProvider>
                  <TooltipProvider>
                    <Suspense fallback={null}>
                      <AppInitializer />
                    </Suspense>
                    {children}
                    <Toaster />
                    <Suspense fallback={null}>
                      <PerformanceMonitor />
                    </Suspense>
                  </TooltipProvider>
                </NotificationsProvider>
              </AuthProvider>
            </ThemeProvider>
          </ReactQueryClientProvider>
        </ErrorBoundary>
      </body>
    </html>
  )
}
