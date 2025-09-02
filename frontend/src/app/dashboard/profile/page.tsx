"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { doc, getDoc, updateDoc } from "firebase/firestore"
import {
  updateProfile,
  updateEmail,
  updatePassword,
  EmailAuthProvider,
  reauthenticateWithCredential,
} from "firebase/auth"
import { auth, db } from "../../../lib/firebase"
import { useAuthState } from "react-firebase-hooks/auth"
import { motion } from "framer-motion"
import { DashboardSidebar } from "../../../components/dashboard/sidebar"
import { Input } from "../../../components/ui/input"
import { Button } from "../../../components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "../../../components/ui/avatar"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../../components/ui/tabs"
import { Eye, EyeOff, Save, User } from "lucide-react"
import { useToast } from "../../../hooks/use-toast"
import type { UserProfile } from "../../../lib/types"

export default function ProfilePage() {
  const [collapsed, setCollapsed] = useState(false)
  const [user, loading] = useAuthState(auth)
  const router = useRouter()
  const { toast } = useToast()

  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [updating, setUpdating] = useState(false)
  const [userData, setUserData] = useState<UserProfile | null>(null)
  const [isInitialized, setIsInitialized] = useState(false)

  // Redirect if not logged in
  useEffect(() => {
    if (!loading && !user) {
      router.push("/login")
    }
  }, [user, loading, router])

  // Fetch user data only once when component mounts and user is available
  useEffect(() => {
    if (!user || isInitialized) return
    
    const fetchUserData = async () => {
      try {
        const userDoc = await getDoc(doc(db, "users", user.uid))
        if (userDoc.exists()) {
          setUserData(userDoc.data() as UserProfile)
        }

        setName(user.displayName || "")
        setEmail(user.email || "")
        setIsInitialized(true)
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "There was an error loading your profile"
        toast({
          title: "Error loading profile",
          description: errorMessage,
          variant: "destructive",
        })
        setIsInitialized(true)
      }
    }

    fetchUserData()
  }, [user, toast, isInitialized])

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return

    setUpdating(true)
    try {
      // Update display name in Firebase Auth
      await updateProfile(user, { displayName: name })

      // Update user document in Firestore
      await updateDoc(doc(db, "users", user.uid), {
        name,
      })

      // Update email if changed
      if (email !== user.email) {
        await updateEmail(user, email)

        // Update email in Firestore
        await updateDoc(doc(db, "users", user.uid), {
          email,
        })
      }

      toast({
        title: "Profile updated",
        description: "Your profile has been updated successfully",
      })
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "There was an error updating your profile"
      toast({
        title: "Error updating profile",
        description: errorMessage,
        variant: "destructive",
      })
    } finally {
      setUpdating(false)
    }
  }

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || !user.email) return

    if (newPassword !== confirmPassword) {
      toast({
        title: "Passwords don't match",
        description: "New password and confirmation password must match",
        variant: "destructive",
      })
      return
    }

    setUpdating(true)
    try {
      // Re-authenticate user
      const credential = EmailAuthProvider.credential(user.email, currentPassword)
      await reauthenticateWithCredential(user, credential)

      // Update password
      await updatePassword(user, newPassword)

      // Clear password fields
      setCurrentPassword("")
      setNewPassword("")
      setConfirmPassword("")

      toast({
        title: "Password updated",
        description: "Your password has been updated successfully",
      })
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "There was an error updating your password"
      toast({
        title: "Error updating password",
        description: errorMessage,
        variant: "destructive",
      })
    } finally {
      setUpdating(false)
    }
  }

  if (loading || !isInitialized) {
    return (
      <div className="flex h-screen bg-dark text-cream overflow-hidden">
        <DashboardSidebar collapsed={collapsed} setCollapsed={setCollapsed} />
        <main className="flex-1 overflow-auto p-6 md:p-8 lg:p-10">
          <div className="max-w-3xl mx-auto">
            <div className="flex items-center justify-center h-[calc(100vh-200px)]">
              <div className="animate-pulse">Loading profile...</div>
            </div>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-dark text-cream overflow-hidden">
      <DashboardSidebar collapsed={collapsed} setCollapsed={setCollapsed} />

      <main className="flex-1 overflow-auto p-6 md:p-8 lg:p-10">
        <div className="max-w-3xl mx-auto">
          <header className="mb-8">
            <h1 className="text-2xl md:text-3xl font-medium font-outfit">Profile</h1>
            <p className="text-cream/60 text-sm mt-1 font-outfit">Manage your account settings and preferences</p>
          </header>

          <Tabs defaultValue="account" className="space-y-6">
            <TabsList className="bg-cream/5 text-cream">
              <TabsTrigger value="account" className="data-[state=active]:bg-cream/10">
                Account
              </TabsTrigger>
              <TabsTrigger value="security" className="data-[state=active]:bg-cream/10">
                Security
              </TabsTrigger>
            </TabsList>

            <TabsContent value="account">
              <motion.div
                className="bg-cream/5 rounded-xl border border-cream/10 p-6"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
              >
                <div className="flex flex-col md:flex-row gap-8 items-start mb-8">
                  <div className="flex flex-col items-center">
                    <Avatar className="h-24 w-24 mb-4">
                      {user?.photoURL ? (
                        <AvatarImage src={user.photoURL} alt={name} />
                      ) : null}
                      <AvatarFallback className="text-2xl">
                        {name ? name.charAt(0).toUpperCase() : user?.displayName?.charAt(0)?.toUpperCase() || "U"}
                      </AvatarFallback>
                    </Avatar>
                    <Button
                      variant="outline"
                      className="text-xs bg-cream/5 border-cream/10 text-cream hover:bg-cream/10 hover:text-cream"
                    >
                      Change Avatar
                    </Button>
                  </div>
                  <div className="flex-1">
                    <h2 className="text-xl font-medium mb-2">{name || "User"}</h2>
                    <p className="text-cream/60 text-sm mb-4">{email || "No email"}</p>
                    <p className="text-cream/60 text-sm">
                      Member since:{" "}
                      {userData?.createdAt ? new Date(
                        typeof userData.createdAt === 'object' && userData.createdAt && 'toDate' in userData.createdAt 
                          ? (userData.createdAt as { toDate(): Date }).toDate() 
                          : userData.createdAt as string | number
                      ).toLocaleDateString() : "Unknown"}
                    </p>
                  </div>
                </div>

                <form onSubmit={handleUpdateProfile} className="space-y-6">
                  <div className="space-y-2">
                    <label htmlFor="name" className="text-sm font-outfit block">
                      Full Name
                    </label>
                    <Input
                      id="name"
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Your name"
                      required
                      className="bg-cream/5 border-cream/10 text-cream placeholder:text-cream/40 focus-visible:ring-cream/20"
                    />
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="email" className="text-sm font-outfit block">
                      Email
                    </label>
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Your email"
                      required
                      className="bg-cream/5 border-cream/10 text-cream placeholder:text-cream/40 focus-visible:ring-cream/20"
                    />
                  </div>

                  <div className="pt-4 flex justify-end">
                    <Button
                      type="submit"
                      disabled={updating}
                      className="bg-cream text-dark hover:bg-cream/90 font-medium"
                    >
                      {updating ? "Saving..." : "Save Changes"}
                      {!updating && <Save className="ml-2 h-4 w-4" />}
                    </Button>
                  </div>
                </form>
              </motion.div>
            </TabsContent>

            <TabsContent value="security">
              <motion.div
                className="bg-cream/5 rounded-xl border border-cream/10 p-6"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
              >
                <h2 className="text-xl font-medium mb-6">Change Password</h2>
                <form onSubmit={handleUpdatePassword} className="space-y-6">
                  <div className="space-y-2">
                    <label htmlFor="current-password" className="text-sm font-outfit block">
                      Current Password
                    </label>
                    <div className="relative">
                      <Input
                        id="current-password"
                        type={showCurrentPassword ? "text" : "password"}
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        placeholder="••••••••"
                        required
                        className="bg-cream/5 border-cream/10 text-cream placeholder:text-cream/40 focus-visible:ring-cream/20 pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-cream/40 hover:text-cream transition-colors"
                      >
                        {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="new-password" className="text-sm font-outfit block">
                      New Password
                    </label>
                    <div className="relative">
                      <Input
                        id="new-password"
                        type={showNewPassword ? "text" : "password"}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="••••••••"
                        required
                        minLength={6}
                        className="bg-cream/5 border-cream/10 text-cream placeholder:text-cream/40 focus-visible:ring-cream/20 pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-cream/40 hover:text-cream transition-colors"
                      >
                        {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="confirm-password" className="text-sm font-outfit block">
                      Confirm New Password
                    </label>
                    <div className="relative">
                      <Input
                        id="confirm-password"
                        type={showConfirmPassword ? "text" : "password"}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="••••••••"
                        required
                        minLength={6}
                        className="bg-cream/5 border-cream/10 text-cream placeholder:text-cream/40 focus-visible:ring-cream/20 pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-cream/40 hover:text-cream transition-colors"
                      >
                        {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="pt-4 flex justify-end">
                    <Button
                      type="submit"
                      disabled={updating}
                      className="bg-cream text-dark hover:bg-cream/90 font-medium"
                    >
                      {updating ? "Updating..." : "Update Password"}
                      {!updating && <Save className="ml-2 h-4 w-4" />}
                    </Button>
                  </div>
                </form>
              </motion.div>
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  )
}

