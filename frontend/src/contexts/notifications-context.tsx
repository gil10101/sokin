"use client"

import type React from "react"
import { createContext, useContext, useState, useEffect, useCallback } from "react"
import { useAuth } from "@/contexts/auth-context"
import { logger } from "@/lib/logger"
import { notificationsAPI } from "@/lib/api"

export type NotificationType = "info" | "success" | "warning" | "error" | "budget" | "system"

export interface Notification {
  id: string
  title: string
  message: string
  type: NotificationType
  read: boolean
  dismissed: boolean
  createdAt: string
  link?: string
}

interface NotificationsContextType {
  notifications: Notification[]
  unreadCount: number
  addNotification: (notification: Omit<Notification, "id" | "read" | "dismissed" | "createdAt">) => Promise<void>
  markAsRead: (id: string) => Promise<void>
  markAllAsRead: () => Promise<void>
  dismissNotification: (id: string) => Promise<void>
  dismissAllNotifications: () => Promise<void>
  deleteNotification: (id: string) => Promise<void>
}

const NotificationsContext = createContext<NotificationsContextType | null>(null)

export const useNotifications = () => {
  const context = useContext(NotificationsContext)
  if (!context) {
    throw new Error("useNotifications must be used within a NotificationsProvider")
  }
  return context
}

export const NotificationsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const { user } = useAuth()
  const [unreadCount, setUnreadCount] = useState(0)

  const normalizeType = (type: string): NotificationType => {
    switch (type) {
      case "info":
      case "success":
      case "warning":
      case "error":
      case "system":
        return type
      case "budget_warning":
      case "budget_exceeded":
      case "budget_alert":
        return "budget"
      case "bill_reminder":
      case "goal_milestone":
      case "spending_insight":
        return "info"
      default:
        return "info"
    }
  }

  const mapTypeForApi = (type: NotificationType): string => {
    switch (type) {
      case "budget":
        return "budget_warning"
      case "system":
        return "system"
      default:
        return type
    }
  }

  const refreshNotifications = useCallback(async () => {
    if (!user) return
    try {
      const data = await notificationsAPI.getNotifications()
      const normalized = data.map((notification) => ({
        id: notification.id,
        title: notification.title,
        message: notification.message,
        type: normalizeType(notification.type),
        read: Boolean(notification.read),
        dismissed: Boolean(notification.dismissed),
        createdAt: notification.createdAt,
        link: notification.link
      }))
      setNotifications(normalized)
      setUnreadCount(normalized.filter((n) => !n.read).length)
    } catch (error: unknown) {
      logger.error("Failed to fetch notifications", {
        error: error instanceof Error ? error.message : "Unknown error",
        userId: user?.uid
      })
    }
  }, [user])

  // Fetch notifications when user changes
  useEffect(() => {
    if (!user) {
      setNotifications([])
      setUnreadCount(0)
      return
    }

    refreshNotifications()
    const intervalId = setInterval(refreshNotifications, 30000)

    return () => clearInterval(intervalId)
  }, [user, refreshNotifications])

  const addNotification = async (notification: Omit<Notification, "id" | "read" | "dismissed" | "createdAt">) => {
    if (!user) return

    try {
      await notificationsAPI.createNotification({
        title: notification.title,
        message: notification.message,
        type: mapTypeForApi(notification.type),
        data: {},
        link: notification.link
      })
      await refreshNotifications()
    } catch (error: unknown) {
      // Failed to add notification - user will not see this notification
      logger.error('Failed to add notification', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: user?.uid
      });
    }
  }

  const markAsRead = async (id: string) => {
    if (!user) return

    try {
      await notificationsAPI.markAsRead(id)
      setNotifications((prev) =>
        prev.map((notification) =>
          notification.id === id ? { ...notification, read: true } : notification
        )
      )
      setUnreadCount((prev) => Math.max(0, prev - 1))
    } catch (error: unknown) {
      // Failed to mark notification as read - will remain unread
      logger.error('Failed to mark notification as read', {
        error: error instanceof Error ? error.message : 'Unknown error',
        notificationId: id,
        userId: user?.uid
      });
    }
  }

  const markAllAsRead = async () => {
    if (!user) return

    try {
      await notificationsAPI.markAllAsRead()
      setNotifications((prev) =>
        prev.map((notification) => ({ ...notification, read: true }))
      )
      setUnreadCount(0)
    } catch (error: unknown) {
      // Failed to mark all notifications as read - some may remain unread
      logger.error('Failed to mark all notifications as read', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: user?.uid
      });
    }
  }

  const dismissNotification = async (id: string) => {
    if (!user) return

    try {
      await notificationsAPI.dismissNotification(id)
      setNotifications((prev) => prev.filter((notification) => notification.id !== id))
    } catch (error: unknown) {
      // Failed to dismiss notification - will remain visible
      logger.error('Failed to dismiss notification', {
        error: error instanceof Error ? error.message : 'Unknown error',
        notificationId: id,
        userId: user?.uid
      });
    }
  }

  const dismissAllNotifications = async () => {
    if (!user) return

    try {
      await notificationsAPI.dismissAllNotifications()
      setNotifications([])
      setUnreadCount(0)
    } catch (error: unknown) {
      // Failed to dismiss all notifications - some may remain visible
      logger.error('Failed to dismiss all notifications', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: user?.uid
      });
    }
  }

  const deleteNotification = async (id: string) => {
    if (!user) return

    try {
      await notificationsAPI.deleteNotification(id)
      setNotifications((prev) => prev.filter((notification) => notification.id !== id))
    } catch (error: unknown) {
      // Failed to delete notification - will remain in system
      logger.error('Failed to delete notification', {
        error: error instanceof Error ? error.message : 'Unknown error',
        notificationId: id,
        userId: user?.uid
      });
    }
  }

  return (
    <NotificationsContext.Provider
      value={{
        notifications,
        unreadCount,
        addNotification,
        markAsRead,
        markAllAsRead,
        dismissNotification,
        dismissAllNotifications,
        deleteNotification,
      }}
    >
      {children}
    </NotificationsContext.Provider>
  )
}

