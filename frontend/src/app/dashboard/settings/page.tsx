"use client"

import React, { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { MotionDiv } from "@/components/ui/dynamic-motion"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Save, Moon, Globe, CreditCard } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { notificationsAPI, type NotificationPreferences } from "@/lib/api"
import { useAuth } from "@/contexts/auth-context"
import { logger } from "@/lib/logger"

const DEFAULT_PREFERENCES: NotificationPreferences = {
  budgetAlerts: true,
  billReminders: true,
  goalMilestones: true,
  spendingInsights: true,
  pushNotifications: true,
  emailNotifications: true,
}

const PREFERENCE_FIELDS: Array<{ key: keyof NotificationPreferences; label: string; description: string }> = [
  { key: "budgetAlerts", label: "Budget Alerts", description: "Get notified when you're approaching your budget limits" },
  { key: "billReminders", label: "Bill Reminders", description: "Get reminded before bills are due" },
  { key: "goalMilestones", label: "Goal Milestones", description: "Celebrate progress on your savings goals" },
  { key: "spendingInsights", label: "Spending Insights", description: "Periodic insights about your spending patterns" },
  { key: "pushNotifications", label: "Push Notifications", description: "Receive push notifications in your browser" },
  { key: "emailNotifications", label: "Email Notifications", description: "Receive notifications via email" },
]

interface SettingsPageProps {
  params?: Promise<Record<string, string>>;
  searchParams?: Promise<Record<string, string>>;
}

export default function SettingsPage(props: SettingsPageProps) {
  const { user, userData, updateUserSettings, refreshUserData } = useAuth()
  const { toast } = useToast()
  const router = useRouter()

  const [currency, setCurrency] = useState("USD")
  const [preferences, setPreferences] = useState<NotificationPreferences>(DEFAULT_PREFERENCES)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const fetchSettings = async () => {
      if (!user) return

      setLoading(true)
      try {
        const prefs = await notificationsAPI.getNotificationPreferences()
        setPreferences({ ...DEFAULT_PREFERENCES, ...prefs })
      } catch (error: unknown) {
        // Preferences endpoint returns defaults for new users; a failure here
        // still leaves usable defaults in the form
        logger.error("Failed to load notification preferences", {
          error: error instanceof Error ? error.message : "Unknown error",
        })
      } finally {
        setLoading(false)
      }
    }

    fetchSettings()
  }, [user])

  useEffect(() => {
    if (userData?.settings?.currency) {
      setCurrency(userData.settings.currency)
    }
  }, [userData?.settings?.currency])

  const handleSaveSettings = async () => {
    if (!user) return

    setSaving(true)
    try {
      await Promise.all([
        updateUserSettings({ currency }),
        notificationsAPI.updateNotificationPreferences(preferences),
      ])
      await refreshUserData()

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

  const setPreference = (key: keyof NotificationPreferences, value: boolean) => {
    setPreferences((prev) => ({ ...prev, [key]: value }))
  }

  return (
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
            <TabsList className="bg-cream/5 text-cream">
              <TabsTrigger value="general" className="data-[state=active]:bg-cream/10">
                General
              </TabsTrigger>
              <TabsTrigger value="notifications" className="data-[state=active]:bg-cream/10">
                Notifications
              </TabsTrigger>
              <TabsTrigger value="budgets" className="data-[state=active]:bg-cream/10">
                Budgets
              </TabsTrigger>
            </TabsList>

            <TabsContent value="general">
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
                        <Label>Theme</Label>
                      </div>
                      <p className="text-cream/60 text-sm">Sokin currently ships in dark mode only</p>
                    </div>
                    <span className="text-sm text-cream/80 bg-cream/10 rounded-md px-3 py-1.5">Dark</span>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <div className="flex items-center">
                        <Globe className="mr-2 h-4 w-4 text-cream/60" />
                        <Label htmlFor="currency">Currency</Label>
                      </div>
                      <p className="text-cream/60 text-sm">Set your preferred currency</p>
                    </div>
                    <Select value={currency} onValueChange={setCurrency}>
                      <SelectTrigger className="w-[180px] bg-cream/5 border-cream/10 text-cream focus:ring-cream/20">
                        <SelectValue placeholder="Select currency" />
                      </SelectTrigger>
                      <SelectContent className="bg-dark border-cream/10">
                        <SelectItem value="USD" className="text-cream hover:bg-cream/10">
                          USD ($)
                        </SelectItem>
                        <SelectItem value="EUR" className="text-cream hover:bg-cream/10">
                          EUR (€)
                        </SelectItem>
                        <SelectItem value="GBP" className="text-cream hover:bg-cream/10">
                          GBP (£)
                        </SelectItem>
                        <SelectItem value="JPY" className="text-cream hover:bg-cream/10">
                          JPY (¥)
                        </SelectItem>
                        <SelectItem value="CAD" className="text-cream hover:bg-cream/10">
                          CAD ($)
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </MotionDiv>
            </TabsContent>

            <TabsContent value="notifications">
              <MotionDiv
                className="bg-cream/5 rounded-xl border border-cream/10 p-6"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
              >
                <h2 className="text-xl font-medium mb-6">Notification Settings</h2>

                <div className="space-y-6">
                  {PREFERENCE_FIELDS.map((field) => (
                    <div key={field.key} className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label htmlFor={`pref-${field.key}`}>{field.label}</Label>
                        <p className="text-cream/60 text-sm">{field.description}</p>
                      </div>
                      <Switch
                        id={`pref-${field.key}`}
                        checked={Boolean(preferences[field.key])}
                        onCheckedChange={(checked: boolean) => setPreference(field.key, checked)}
                      />
                    </div>
                  ))}
                </div>
              </MotionDiv>
            </TabsContent>

            <TabsContent value="budgets">
              <MotionDiv
                className="bg-cream/5 rounded-xl border border-cream/10 p-6"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
              >
                <h2 className="text-xl font-medium mb-6">Budget Settings</h2>

                <div className="space-y-6">
                  <p className="text-cream/60">
                    Set monthly budget limits for different categories to help manage your spending.
                  </p>

                  <div className="bg-cream/10 rounded-lg p-6 text-center">
                    <CreditCard className="h-12 w-12 mx-auto mb-4 text-cream/40" />
                    <h3 className="text-lg font-medium mb-2">Budget Management</h3>
                    <p className="text-cream/60 mb-4">
                      Set up and manage your category budgets to track your spending goals.
                    </p>
                    <Button
                      onClick={() => router.push("/dashboard/budgets")}
                      className="bg-cream text-dark hover:bg-cream/90"
                    >
                      Set Up Budgets
                    </Button>
                  </div>
                </div>
              </MotionDiv>
            </TabsContent>
          </Tabs>
        )}

        <div className="mt-8 flex justify-end">
          <Button
            onClick={handleSaveSettings}
            disabled={saving || loading}
            className="bg-cream text-dark hover:bg-cream/90 font-medium"
          >
            {saving ? "Saving..." : "Save Settings"}
            {!saving && <Save className="ml-2 h-4 w-4" />}
          </Button>
        </div>
      </div>
    </main>
  )
}
