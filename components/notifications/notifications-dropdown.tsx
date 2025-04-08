"use client"

import { useState } from "react"
import { Bell, Check, Trash2, X, Info, AlertTriangle, CheckCircle, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { useNotifications, type NotificationType } from "@/contexts/notifications-context"
import { cn } from "@/lib/utils"
import { formatDistanceToNow } from "date-fns"
import Link from "next/link"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { motion, AnimatePresence } from "framer-motion"

export function NotificationsDropdown() {
  const { notifications, unreadCount, markAsRead, markAllAsRead, dismissNotification, dismissAllNotifications } =
    useNotifications()
  const [open, setOpen] = useState(false)
  const [activeTab, setActiveTab] = useState("all")

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen)
    if (isOpen && unreadCount > 0) {
      // Mark all as read when opening the dropdown
      markAllAsRead()
    }
  }

  const getNotificationIcon = (type: NotificationType) => {
    switch (type) {
      case "info":
        return <Info className="h-4 w-4 text-blue-400" />
      case "success":
        return <CheckCircle className="h-4 w-4 text-green-400" />
      case "warning":
        return <AlertTriangle className="h-4 w-4 text-yellow-400" />
      case "error":
        return <AlertCircle className="h-4 w-4 text-red-400" />
      case "budget":
        return <AlertTriangle className="h-4 w-4 text-yellow-400" />
      case "system":
        return <Info className="h-4 w-4 text-cream/60" />
      default:
        return <Info className="h-4 w-4 text-cream/60" />
    }
  }

  const getTimeAgo = (dateString: string) => {
    try {
      const date = new Date(dateString)
      return formatDistanceToNow(date, { addSuffix: true })
    } catch (error) {
      return "Unknown time"
    }
  }

  const filteredNotifications = activeTab === "all" ? notifications : notifications.filter((n) => n.type === activeTab)

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5 text-cream/60" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs text-white">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0 bg-dark border-cream/10">
        <div className="p-3 border-b border-cream/10 flex justify-between items-center">
          <h3 className="font-medium">Notifications</h3>
          <div className="flex gap-2">
            <button
              onClick={() => markAllAsRead()}
              className="text-xs text-cream/60 hover:text-cream"
              title="Mark all as read"
            >
              <Check className="h-4 w-4" />
            </button>
            <button
              onClick={() => dismissAllNotifications()}
              className="text-xs text-cream/60 hover:text-cream"
              title="Dismiss all"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>

        <Tabs defaultValue="all" value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full bg-cream/5 rounded-none border-b border-cream/10">
            <TabsTrigger value="all" className="flex-1 data-[state=active]:bg-cream/10">
              All
            </TabsTrigger>
            <TabsTrigger value="budget" className="flex-1 data-[state=active]:bg-cream/10">
              Budget
            </TabsTrigger>
            <TabsTrigger value="system" className="flex-1 data-[state=active]:bg-cream/10">
              System
            </TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab} className="mt-0">
            <div className="max-h-[300px] overflow-y-auto">
              <AnimatePresence>
                {filteredNotifications.length > 0 ? (
                  filteredNotifications.map((notification) => (
                    <motion.div
                      key={notification.id}
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.2 }}
                      className={cn(
                        "p-3 border-b border-cream/10 hover:bg-cream/5 cursor-pointer",
                        !notification.read && "bg-cream/5",
                      )}
                    >
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5">{getNotificationIcon(notification.type)}</div>
                        <div className="flex-1">
                          <div className="flex justify-between">
                            <h4 className="font-medium text-sm">{notification.title}</h4>
                            <span className="text-xs text-cream/40">{getTimeAgo(notification.createdAt)}</span>
                          </div>
                          <p className="text-sm text-cream/70 mt-1">{notification.message}</p>
                          {notification.link && (
                            <Link
                              href={notification.link}
                              className="text-xs text-cream hover:underline mt-1 inline-block"
                              onClick={() => setOpen(false)}
                            >
                              View details
                            </Link>
                          )}
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            dismissNotification(notification.id)
                          }}
                          className="text-cream/40 hover:text-cream"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    </motion.div>
                  ))
                ) : (
                  <div className="p-4 text-center text-cream/60">
                    <p>No notifications</p>
                  </div>
                )}
              </AnimatePresence>
            </div>
          </TabsContent>
        </Tabs>

        <div className="p-2 border-t border-cream/10">
          <Link
            href="/dashboard/notifications"
            className="text-xs text-cream/60 hover:text-cream flex justify-center items-center"
            onClick={() => setOpen(false)}
          >
            View all notifications
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  )
}

