import type React from "react"
import type { Metadata, Viewport } from "next"
import "./globals.css"
import FontLoader from "../components/font-loader"
import { Providers } from "../components/providers"

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
        />
        {process.env.NEXT_PUBLIC_API_URL && (
          <link rel="dns-prefetch" href={process.env.NEXT_PUBLIC_API_URL} />
        )}
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
      </head>
      <body className="bg-dark text-cream antialiased">
        <FontLoader />
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}