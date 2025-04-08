"use client"

import type React from "react"
import { createContext, useContext, useState, useEffect } from "react"
import { collection, query, where, orderBy, doc, updateDoc, deleteDoc, addDoc, onSnapshot } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { useAuth } from "@/contexts/auth-context"

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

  // Fetch notifications when user changes
  useEffect(() => {
    if (!user) {
      setNotifications([])
      setUnreadCount(0)
      return
    }

    const notificationsRef = collection(db, "notifications")
    const q = query(
      notificationsRef,
      where("userId", "==", user.uid),
      where("dismissed", "==", false),
      orderBy("createdAt", "desc"),
    )

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const notificationsData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Notification[]

      setNotifications(notificationsData)
      setUnreadCount(notificationsData.filter((n) => !n.read).length)
    })

    return () => unsubscribe()
  }, [user])

  const addNotification = async (notification: Omit<Notification, "id" | "read" | "dismissed" | "createdAt">) => {
    if (!user) return

    try {
      await addDoc(collection(db, "notifications"), {
        ...notification,
        userId: user.uid,
        read: false,
        dismissed: false,
        createdAt: new Date().toISOString(),
      })
    } catch (error) {
      console.error("Error adding notification:", error)
    }
  }

  const markAsRead = async (id: string) => {
    if (!user) return

    try {
      await updateDoc(doc(db, "notifications", id), {
        read: true,
      })
    } catch (error) {
      console.error("Error marking notification as read:", error)
    }
  }

  const markAllAsRead = async () => {
    if (!user) return

    try {
      const promises = notifications
        .filter((n) => !n.read)
        .map((n) => updateDoc(doc(db, "notifications", n.id), { read: true }))

      await Promise.all(promises)
    } catch (error) {
      console.error("Error marking all notifications as read:", error)
    }
  }

  const dismissNotification = async (id: string) => {
    if (!user) return

    try {
      await updateDoc(doc(db, "notifications", id), {
        dismissed: true,
      })
    } catch (error) {
      console.error("Error dismissing notification:", error)
    }
  }

  const dismissAllNotifications = async () => {
    if (!user) return

    try {
      const promises = notifications.map((n) => updateDoc(doc(db, "notifications", n.id), { dismissed: true }))

      await Promise.all(promises)
    } catch (error) {
      console.error("Error dismissing all notifications:", error)
    }
  }

  const deleteNotification = async (id: string) => {
    if (!user) return

    try {
      await deleteDoc(doc(db, "notifications", id))
    } catch (error) {
      console.error("Error deleting notification:", error)
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

