"use client"

import React, { useState, useEffect } from "react"
import { doc, getDoc, updateDoc } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { MotionDiv } from "../../../components/ui/dynamic-motion"
import { DashboardSidebar } from "@/components/dashboard/sidebar"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Save, Moon, Globe, LogOut, User, Mail } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/contexts/auth-context"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"

// Properly typed UI components
const TypedSelectTrigger = SelectTrigger
const TypedSelectContent = SelectContent
const TypedSelectItem = SelectItem
const TypedTabsList = TabsList
const TypedTabsTrigger = TabsTrigger
const TypedTabsContent = TabsContent
const TypedLabel = Label
const TypedSwitch = Switch
const TypedButton = Button

interface Settings {
  theme: string;
  currency: string;
  notifications: {
    email: boolean;
    push: boolean;
    monthlyReport: boolean;
    budgetAlerts: boolean;
    expenseNotifications: boolean;
  };
  categories: string[];
  budgets: Record<string, number>;
}

export default function SettingsPage() {
  const [collapsed, setCollapsed] = useState(false)
  const { user, signOut } = useAuth()
  const { toast } = useToast()
  const [isSigningOut, setIsSigningOut] = useState(false)

  const [settings, setSettings] = useState<Settings>({
    theme: "dark",
    currency: "USD",
    notifications: {
      email: true,
      push: true,
      monthlyReport: true,
      budgetAlerts: true,
      expenseNotifications: true,
    },
    categories: [],
    budgets: {},
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const fetchSettings = async () => {
      if (!user) return

      setLoading(true)
      try {
        const userDoc = await getDoc(doc(db, "users", user.uid))
        if (userDoc.exists() && userDoc.data().settings) {
          const userData = userDoc.data();
          const serializedSettings = {
            ...userData.settings,
          };
          setSettings(serializedSettings);
        }
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "There was an error loading your settings"
        toast({
          title: "Error loading settings",
          description: errorMessage,
          variant: "destructive",
        })
      } finally {
        setLoading(false)
      }
    }

    fetchSettings()
  }, [user, toast])

  const handleSaveSettings = async () => {
    if (!user) return

    setSaving(true)
    try {
      await updateDoc(doc(db, "users", user.uid), {
        settings,
      })

      toast({
        title: "Settings saved",
        description: "Your settings have been updated successfully",
      })
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "There was an error saving your settings"
      toast({
        title: "Error saving settings",
        description: errorMessage,
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  const updateSetting = (path: string[], value: unknown) => {
    setSettings((prevSettings) => {
      const newSettings = { ...prevSettings }
      let current: Record<string, unknown> = newSettings

      // Navigate to the nested property
      for (let i = 0; i < path.length - 1; i++) {
        const key = path[i]
        if (typeof current[key] === 'object' && current[key] !== null) {
          current = current[key] as Record<string, unknown>
        } else {
          // Create nested object if it doesn't exist
          current[key] = {}
          current = current[key] as Record<string, unknown>
        }
      }

      // Set the value
      const lastKey = path[path.length - 1]
      current[lastKey] = value

      return newSettings
    })
  }

  const handleSignOut = async () => {
    setIsSigningOut(true)
    try {
      await signOut()
      toast({
        title: "Signed out successfully",
        description: "You have been signed out of your account",
      })
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Failed to sign out"
      toast({
        title: "Error signing out",
        description: errorMessage,
        variant: "destructive",
      })
    } finally {
      setIsSigningOut(false)
    }
  }

  return (
    <div className="flex h-screen bg-dark text-cream overflow-hidden">
      <DashboardSidebar collapsed={collapsed} setCollapsed={setCollapsed} />

      <main className="flex-1 overflow-auto p-6 md:p-8 lg:p-10">
        <div className="max-w-3xl mx-auto">
          <header className="mb-8">
            <h1 className="text-2xl md:text-3xl font-medium font-outfit">Settings</h1>
            <p className="text-cream/60 text-sm mt-1 font-outfit">Customize your application preferences</p>
          </header>

          {loading ? (
            <div className="space-y-6">
              {[1, 2, 3].map((i) => (
                <div key={i} className="bg-cream/5 rounded-xl border border-cream/10 p-6 h-[200px] animate-pulse" />
              ))}
            </div>
          ) : (
            <Tabs defaultValue="general" className="space-y-6">
              <TypedTabsList className="bg-cream/5 text-cream">
                <TypedTabsTrigger value="general" className="data-[state=active]:bg-cream/10">
                  General
                </TypedTabsTrigger>
                <TypedTabsTrigger value="notifications" className="data-[state=active]:bg-cream/10">
                  Notifications
                </TypedTabsTrigger>
                <TypedTabsTrigger value="account" className="data-[state=active]:bg-cream/10">
                  Account
                </TypedTabsTrigger>
              </TypedTabsList>

              <TypedTabsContent value="general">
                <MotionDiv
                  className="bg-cream/5 rounded-xl border border-cream/10 p-6"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5 }}
                >
                  <h2 className="text-xl font-medium mb-6">General Settings</h2>

                  <div className="space-y-6">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <div className="flex items-center">
                          <Moon className="mr-2 h-4 w-4 text-cream/60" />
                          <TypedLabel htmlFor="theme">Theme</TypedLabel>
                        </div>
                        <p className="text-cream/60 text-sm">Choose your preferred theme</p>
                      </div>
                      <Select value={settings.theme} onValueChange={(value) => updateSetting(["theme"], value)}>
                        <TypedSelectTrigger className="w-[180px] bg-cream/5 border-cream/10 text-cream focus:ring-cream/20">
                          <SelectValue placeholder="Select theme" />
                        </TypedSelectTrigger>
                        <TypedSelectContent className="bg-dark border-cream/10">
                          <TypedSelectItem value="dark" className="text-cream hover:bg-cream/10">
                            Dark
                          </TypedSelectItem>
                          <TypedSelectItem value="light" className="text-cream hover:bg-cream/10">
                            Light
                          </TypedSelectItem>
                          <TypedSelectItem value="system" className="text-cream hover:bg-cream/10">
                            System
                          </TypedSelectItem>
                        </TypedSelectContent>
                      </Select>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <div className="flex items-center">
                          <Globe className="mr-2 h-4 w-4 text-cream/60" />
                          <TypedLabel htmlFor="currency">Currency</TypedLabel>
                        </div>
                        <p className="text-cream/60 text-sm">Set your preferred currency</p>
                      </div>
                      <Select value={settings.currency} onValueChange={(value) => updateSetting(["currency"], value)}>
                        <TypedSelectTrigger className="w-[180px] bg-cream/5 border-cream/10 text-cream focus:ring-cream/20">
                          <SelectValue placeholder="Select currency" />
                        </TypedSelectTrigger>
                        <TypedSelectContent className="bg-dark border-cream/10">
                          <TypedSelectItem value="USD" className="text-cream hover:bg-cream/10">
                            USD ($)
                          </TypedSelectItem>
                          <TypedSelectItem value="EUR" className="text-cream hover:bg-cream/10">
                            EUR (€)
                          </TypedSelectItem>
                          <TypedSelectItem value="GBP" className="text-cream hover:bg-cream/10">
                            GBP (£)
                          </TypedSelectItem>
                          <TypedSelectItem value="JPY" className="text-cream hover:bg-cream/10">
                            JPY (¥)
                          </TypedSelectItem>
                          <TypedSelectItem value="CAD" className="text-cream hover:bg-cream/10">
                            CAD ($)
                          </TypedSelectItem>
                        </TypedSelectContent>
                      </Select>
                    </div>
                  </div>
                </MotionDiv>
              </TypedTabsContent>

              <TypedTabsContent value="notifications">
                <MotionDiv
                  className="bg-cream/5 rounded-xl border border-cream/10 p-6"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5 }}
                >
                  <h2 className="text-xl font-medium mb-6">Notification Settings</h2>

                  <div className="space-y-6">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <TypedLabel htmlFor="email-notifications">Email Notifications</TypedLabel>
                        <p className="text-cream/60 text-sm">Receive notifications via email</p>
                      </div>
                      <TypedSwitch
                        id="email-notifications"
                        checked={settings.notifications?.email}
                        onCheckedChange={(checked: boolean) => updateSetting(["notifications", "email"], checked)}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <TypedLabel htmlFor="push-notifications">Push Notifications</TypedLabel>
                        <p className="text-cream/60 text-sm">Receive push notifications in your browser</p>
                      </div>
                      <TypedSwitch
                        id="push-notifications"
                        checked={settings.notifications?.push}
                        onCheckedChange={(checked: boolean) => updateSetting(["notifications", "push"], checked)}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <TypedLabel htmlFor="budget-alerts">Budget Alerts</TypedLabel>
                        <p className="text-cream/60 text-sm">Get notified when you&apos;re approaching your budget limits</p>
                      </div>
                      <TypedSwitch
                        id="budget-alerts"
                        checked={settings.notifications?.budgetAlerts}
                        onCheckedChange={(checked: boolean) => updateSetting(["notifications", "budgetAlerts"], checked)}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <TypedLabel htmlFor="expense-notifications">Expense Notifications</TypedLabel>
                        <p className="text-cream/60 text-sm">Get notified about expense changes and updates</p>
                      </div>
                      <TypedSwitch
                        id="expense-notifications"
                        checked={settings.notifications?.expenseNotifications ?? true}
                        onCheckedChange={(checked: boolean) => updateSetting(["notifications", "expenseNotifications"], checked)}
                      />
                    </div>
                  </div>
                </MotionDiv>
              </TypedTabsContent>

              <TypedTabsContent value="account">
                <MotionDiv
                  className="bg-cream/5 rounded-xl border border-cream/10 p-6"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5 }}
                >
                  <h2 className="text-xl font-medium mb-6">Account Information</h2>

                  <div className="space-y-6">
                    <div className="space-y-4 pb-6 border-b border-cream/10">
                      <div className="flex items-center space-x-3">
                        <div className="h-12 w-12 rounded-full bg-cream/10 flex items-center justify-center">
                          <User className="h-6 w-6 text-cream/60" />
                        </div>
                        <div>
                          <p className="text-sm text-cream/60">Display Name</p>
                          <p className="font-medium">{user?.displayName || "Not set"}</p>
                        </div>
                      </div>

                      <div className="flex items-center space-x-3">
                        <div className="h-12 w-12 rounded-full bg-cream/10 flex items-center justify-center">
                          <Mail className="h-6 w-6 text-cream/60" />
                        </div>
                        <div>
                          <p className="text-sm text-cream/60">Email Address</p>
                          <p className="font-medium">{user?.email || "Not available"}</p>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <h3 className="text-lg font-medium">Sign Out</h3>
                      <p className="text-cream/60 text-sm">
                        Sign out of your account on this device. You can sign back in anytime.
                      </p>
                      
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <TypedButton
                            variant="destructive"
                            className="bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20"
                            disabled={isSigningOut}
                          >
                            <LogOut className="mr-2 h-4 w-4" />
                            {isSigningOut ? "Signing out..." : "Sign Out"}
                          </TypedButton>
                        </AlertDialogTrigger>
                        <AlertDialogContent className="bg-dark border-cream/10">
                          <AlertDialogHeader>
                            <AlertDialogTitle className="text-cream">Confirm Sign Out</AlertDialogTitle>
                            <AlertDialogDescription className="text-cream/60">
                              Are you sure you want to sign out? You will need to sign in again to access your account.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel className="bg-cream/5 border-cream/10 text-cream hover:bg-cream/10">
                              Cancel
                            </AlertDialogCancel>
                            <AlertDialogAction
                              onClick={handleSignOut}
                              className="bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20"
                            >
                              Sign Out
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                </MotionDiv>
              </TypedTabsContent>
            </Tabs>
          )}

          <div className="mt-8 flex justify-end">
            <TypedButton
              onClick={handleSaveSettings}
              disabled={saving || loading}
              className="bg-cream text-dark hover:bg-cream/90 font-medium"
            >
              {saving ? "Saving..." : "Save Settings"}
              {!saving && <Save className="ml-2 h-4 w-4" />}
            </TypedButton>
          </div>
        </div>
      </main>
    </div>
  )
}

