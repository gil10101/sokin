import type React from "react"
import type { Metadata, Viewport } from "next"
import "./globals.css"
import { ThemeProvider } from "../components/theme-provider"
import { AuthProvider } from "../contexts/auth-context"
import { Toaster } from "../components/ui/toaster"
import { TooltipProvider } from "../components/ui/tooltip"
import { Suspense } from 'react'
import { LoadingSpinner } from "../components/ui/loading-spinner"
import { ReactQueryClientProvider } from "../../../lib/react-query-provider"
import { ErrorBoundary } from "../components/error-boundary"
import { AppInitializer } from "../components/app-initializer"

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
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&family=Roboto+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
        <link rel="dns-prefetch" href={process.env.NEXT_PUBLIC_API_URL} />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
      </head>
      <body className="bg-dark text-cream antialiased">
        <ErrorBoundary>
          <ReactQueryClientProvider>
            <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false} disableTransitionOnChange>
              <AuthProvider>
                <TooltipProvider>
                  <AppInitializer />
                  <Suspense fallback={<LoadingSpinner size="lg" />}>
                    {children}
                  </Suspense>
                  <Toaster />
                </TooltipProvider>
              </AuthProvider>
            </ThemeProvider>
          </ReactQueryClientProvider>
        </ErrorBoundary>
      </body>
    </html>
  )
}