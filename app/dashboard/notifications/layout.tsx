import type { Metadata, Viewport } from "next"

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#000000',
}

export const metadata: Metadata = {
  title: "Notifications - Sokin",
  description: "Manage your notification preferences",
}

export default function NotificationsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
} 