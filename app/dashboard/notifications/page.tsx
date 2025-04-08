"use client"

import React, { useState } from "react"
import { DashboardSidebar } from "@/components/dashboard/sidebar"
import { PageHeader } from "@/components/dashboard/page-header"
import { useNotifications, type NotificationType } from "@/contexts/notifications-context"
import { format } from "date-fns"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Info, AlertTriangle, CheckCircle, AlertCircle, Trash2, Check, X } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { LoadingSpinner } from "@/components/ui/loading-spinner"

export default function NotificationsPage() {
  const [collapsed, setCollapsed] = useState(false)
  const { notifications, markAsRead, markAllAsRead, dismissNotification, dismissAllNotifications, deleteNotification } =
    useNotifications()
  const [activeTab, setActiveTab] = useState("all")
  const [mounted, setMounted] = useState(false)

  React.useEffect(() => {
    setMounted(true)
  }, [])

  const getNotificationIcon = (type: NotificationType) => {
    switch (type) {
      case "info":
        return <Info className="h-5 w-5 text-blue-400" />
      case "success":
        return <CheckCircle className="h-5 w-5 text-green-400" />
      case "warning":
        return <AlertTriangle className="h-5 w-5 text-yellow-400" />
      case "error":
        return <AlertCircle className="h-5 w-5 text-red-400" />
      case "budget":
        return <AlertTriangle className="h-5 w-5 text-yellow-400" />
      case "system":
        return <Info className="h-5 w-5 text-cream/60" />
      default:
        return <Info className="h-5 w-5 text-cream/60" />
    }
  }

  const filteredNotifications = activeTab === "all" ? notifications : notifications.filter((n) => n.type === activeTab)

  if (!mounted) {
    return (
      <div className="flex h-screen items-center justify-center bg-dark text-cream">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-dark text-cream overflow-hidden">
      <DashboardSidebar collapsed={collapsed} setCollapsed={setCollapsed} />

      <main className="flex-1 overflow-auto p-6 md:p-8 lg:p-10">
        <div className="max-w-5xl mx-auto">
          <PageHeader
            title="Notifications"
            description="Manage your notifications and alerts"
            action={
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => markAllAsRead()}
                  className="bg-transparent border-cream/10 text-cream hover:bg-cream/10"
                >
                  <Check className="mr-2 h-4 w-4" />
                  Mark all as read
                </Button>
                <Button
                  variant="outline"
                  onClick={() => dismissAllNotifications()}
                  className="bg-transparent border-cream/10 text-cream hover:bg-cream/10"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Dismiss all
                </Button>
              </div>
            }
          />

          <div className="bg-cream/5 rounded-xl border border-cream/10 p-6 mb-8">
            <Tabs defaultValue="all" value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="bg-cream/5 text-cream mb-6">
                <TabsTrigger value="all" className="data-[state=active]:bg-cream/10">
                  All Notifications
                </TabsTrigger>
                <TabsTrigger value="budget" className="data-[state=active]:bg-cream/10">
                  Budget Alerts
                </TabsTrigger>
                <TabsTrigger value="system" className="data-[state=active]:bg-cream/10">
                  System
                </TabsTrigger>
                <TabsTrigger value="info" className="data-[state=active]:bg-cream/10">
                  Info
                </TabsTrigger>
              </TabsList>

              <TabsContent value={activeTab} className="mt-0">
                <AnimatePresence>
                  {filteredNotifications.length > 0 ? (
                    <div className="space-y-4">
                      {filteredNotifications.map((notification) => (
                        <motion.div
                          key={notification.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.2 }}
                          className={cn(
                            "p-4 border border-cream/10 rounded-lg hover:bg-cream/5",
                            !notification.read && "bg-cream/5",
                          )}
                        >
                          <div className="flex items-start gap-4">
                            <div className="mt-1">{getNotificationIcon(notification.type)}</div>
                            <div className="flex-1">
                              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
                                <h4 className="font-medium">{notification.title}</h4>
                                <span className="text-xs text-cream/40">
                                  {format(new Date(notification.createdAt), "MMM d, yyyy h:mm a")}
                                </span>
                              </div>
                              <p className="text-cream/70 mt-2">{notification.message}</p>
                              {notification.link && (
                                <Link
                                  href={notification.link}
                                  className="text-sm text-cream hover:underline mt-2 inline-block"
                                >
                                  View details
                                </Link>
                              )}
                            </div>
                            <div className="flex gap-2">
                              {!notification.read && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => markAsRead(notification.id)}
                                  className="h-8 w-8 text-cream/60 hover:text-cream hover:bg-cream/10"
                                  title="Mark as read"
                                >
                                  <Check className="h-4 w-4" />
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => dismissNotification(notification.id)}
                                className="h-8 w-8 text-cream/60 hover:text-cream hover:bg-cream/10"
                                title="Dismiss"
                              >
                                <X className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => deleteNotification(notification.id)}
                                className="h-8 w-8 text-cream/60 hover:text-red-400 hover:bg-cream/10"
                                title="Delete"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-12">
                      <p className="text-cream/60 mb-4">No notifications found</p>
                    </div>
                  )}
                </AnimatePresence>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </main>
    </div>
  )
}

