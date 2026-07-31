"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import {
  updateProfile,
  verifyBeforeUpdateEmail,
  updatePassword,
  EmailAuthProvider,
  reauthenticateWithCredential,
} from "firebase/auth"
import { auth } from "@/lib/firebase"
import { useAuthState } from "react-firebase-hooks/auth"
import { MotionDiv, MotionMain } from "@/components/ui/dynamic-motion"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Eye, EyeOff, Save, User } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import type { UserProfile } from "@/lib/types"
import { userProfileAPI } from "@/lib/api"

interface ProfilePageProps {
  params?: Promise<Record<string, string>>;
  searchParams?: Promise<Record<string, string>>;
}

export default function ProfilePage(props: ProfilePageProps) {
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

  // Fetch user data only once when component mounts and user is available
  useEffect(() => {
    if (!user || isInitialized) return
    
    const fetchUserData = async () => {
      try {
        const profile = await userProfileAPI.getProfile(user.uid)
        setUserData(profile)

        setName(profile.name || user.displayName || "")
        setEmail(profile.email || user.email || "")
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
  }, [user, isInitialized])

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return

    setUpdating(true)
    try {
      // Backend first: if this fails nothing has changed anywhere
      await userProfileAPI.updateProfile(user.uid, {
        name,
      })

      // Then mirror the display name into Firebase Auth
      await updateProfile(user, { displayName: name })

      // Email changes go through Firebase's verification flow - the address
      // only switches after the user clicks the link (works with email
      // enumeration protection, unlike the deprecated updateEmail)
      if (email !== user.email) {
        await verifyBeforeUpdateEmail(user, email)
        toast({
          title: "Confirm your new email",
          description: `We sent a verification link to ${email}. Your email updates once you confirm it.`,
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
      <main className="flex-1 overflow-auto p-6 md:p-8 lg:p-10">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center justify-center h-[calc(100vh-200px)]">
            <div className="animate-pulse">Loading profile...</div>
          </div>
        </div>
      </main>
    )
  }

  return (
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
            <MotionDiv
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
                    name="name"
                    autoComplete="name"
                    type="text"
                    value={name}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
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
                    name="email"
                    autoComplete="email"
                    type="email"
                    value={email}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
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
            </MotionDiv>
          </TabsContent>

          <TabsContent value="security">
            <MotionDiv
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
                      name="current-password"
                      autoComplete="current-password"
                      type={showCurrentPassword ? "text" : "password"}
                      value={currentPassword}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCurrentPassword(e.target.value)}
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
                      name="new-password"
                      autoComplete="new-password"
                      type={showNewPassword ? "text" : "password"}
                      value={newPassword}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewPassword(e.target.value)}
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
                      name="confirm-password"
                      autoComplete="new-password"
                      type={showConfirmPassword ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setConfirmPassword(e.target.value)}
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
            </MotionDiv>
          </TabsContent>
        </Tabs>
      </div>
    </main>
  )
}

