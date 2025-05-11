"use client"

import { createContext, useContext, useEffect, useState, useRef, type ReactNode } from "react"
import {
  type User,
  onAuthStateChanged,
  signOut as firebaseSignOut,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile,
} from "firebase/auth"
import { doc, setDoc, getDoc } from "firebase/firestore"
import { auth, db } from "@/lib/firebase"
import { useRouter } from "next/navigation"
// Import the NotificationsProvider
import { NotificationsProvider } from "./notifications-context"

interface AuthContextType {
  user: User | null
  loading: boolean
  signUp: (name: string, email: string, password: string) => Promise<void>
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
  userData: any
}

// Create context with a default value
const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  signUp: async () => {},
  signIn: async () => {},
  signOut: async () => {},
  userData: null,
})

// Export the useAuth hook
export function useAuth() {
  return useContext(AuthContext)
}

// AuthProvider component
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [userData, setUserData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const unsubscribeRef = useRef<(() => void) | null>(null)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    // Set a timeout to prevent infinite loading
    timeoutRef.current = setTimeout(() => {
      if (loading) {
        console.log("Auth loading timeout reached, forcing loading state to false")
        setLoading(false)
      }
    }, 5000) // 5 second timeout

    // Only set up the listener once
    unsubscribeRef.current = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser)

      if (currentUser) {
        try {
          const userDoc = await getDoc(doc(db, "users", currentUser.uid))
          if (userDoc.exists()) {
            setUserData(userDoc.data())
          }
        } catch (error) {
          console.error("Error fetching user data:", error)
        }
      } else {
        setUserData(null)
      }

      setLoading(false)
    })

    // Clean up the listener and timeout
    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current()
      }
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])

  const signUp = async (name: string, email: string, password: string) => {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password)
      const user = userCredential.user

      // Update profile with name
      await updateProfile(user, {
        displayName: name,
      })

      // Create user document in Firestore
      await setDoc(doc(db, "users", user.uid), {
        name,
        email,
        createdAt: new Date().toISOString(),
        settings: {
          currency: "USD",
          theme: "dark",
          notifications: {
            email: true,
            push: true,
            monthlyReport: true,
            budgetAlerts: true,
          },
        },
      })

      // Also create a default categories collection for this user
      await setDoc(doc(db, "users", user.uid, "categories", "default"), {
        categories: ["Dining", "Shopping", "Transport", "Utilities", "Entertainment", "Health", "Travel", "Other"],
      })

      router.push("/dashboard")
    } catch (error) {
      throw error
    }
  }

  const signIn = async (email: string, password: string) => {
    try {
      await signInWithEmailAndPassword(auth, email, password)
      router.push("/dashboard")
    } catch (error) {
      throw error
    }
  }

  const signOut = async () => {
    try {
      await firebaseSignOut(auth)
      router.push("/")
    } catch (error) {
      console.error("Error signing out:", error)
    }
  }

  const value = {
    user,
    loading,
    signUp,
    signIn,
    signOut,
    userData,
  }

  return (
    <AuthContext.Provider value={value}>
      <NotificationsProvider>{children}</NotificationsProvider>
    </AuthContext.Provider>
  )
}

