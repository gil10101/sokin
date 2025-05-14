"use client"

import { useState, useEffect } from "react"
import { doc, getDoc, updateDoc } from "firebase/firestore"
import { auth, db } from "../../../lib/firebase"
import { useAuthState } from "react-firebase-hooks/auth"
import { motion } from "framer-motion"
import { DashboardSidebar } from "../../../components/dashboard/sidebar"
import { Button } from "../../../components/ui/button"
import { Switch } from "../../../components/ui/switch"
import { Label } from "../../../components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../../components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../../components/ui/tabs"
import { Save, Moon, Globe, CreditCard } from "lucide-react"
import { useToast } from "../../../hooks/use-toast"

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
  const [user] = useAuthState(auth)
  const { toast } = useToast()

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
      } catch (error: any) {
        toast({
          title: "Error loading settings",
          description: error.message || "There was an error loading your settings",
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
    } catch (error: any) {
      toast({
        title: "Error saving settings",
        description: error.message || "There was an error saving your settings",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  const updateSetting = (path: string[], value: any) => {
    setSettings((prevSettings) => {
      const newSettings = { ...prevSettings }
      let current = newSettings

      // Navigate to the nested property
      for (let i = 0; i < path.length - 1; i++) {
        current = current[path[i] as keyof typeof current] as any
      }

      // Set the value
      const lastKey = path[path.length - 1]
      current[lastKey as keyof typeof current] = value

      return newSettings
    })
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
                <motion.div
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
                          <Label htmlFor="theme">Theme</Label>
                        </div>
                        <p className="text-cream/60 text-sm">Choose your preferred theme</p>
                      </div>
                      <Select value={settings.theme} onValueChange={(value) => updateSetting(["theme"], value)}>
                        <SelectTrigger className="w-[180px] bg-cream/5 border-cream/10 text-cream focus:ring-cream/20">
                          <SelectValue placeholder="Select theme" />
                        </SelectTrigger>
                        <SelectContent className="bg-dark border-cream/10">
                          <SelectItem value="dark" className="text-cream hover:bg-cream/10">
                            Dark
                          </SelectItem>
                          <SelectItem value="light" className="text-cream hover:bg-cream/10">
                            Light
                          </SelectItem>
                          <SelectItem value="system" className="text-cream hover:bg-cream/10">
                            System
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <div className="flex items-center">
                          <Globe className="mr-2 h-4 w-4 text-cream/60" />
                          <Label htmlFor="currency">Currency</Label>
                        </div>
                        <p className="text-cream/60 text-sm">Set your preferred currency</p>
                      </div>
                      <Select value={settings.currency} onValueChange={(value) => updateSetting(["currency"], value)}>
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
                </motion.div>
              </TabsContent>

              <TabsContent value="notifications">
                <motion.div
                  className="bg-cream/5 rounded-xl border border-cream/10 p-6"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5 }}
                >
                  <h2 className="text-xl font-medium mb-6">Notification Settings</h2>

                  <div className="space-y-6">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label htmlFor="email-notifications">Email Notifications</Label>
                        <p className="text-cream/60 text-sm">Receive notifications via email</p>
                      </div>
                      <Switch
                        id="email-notifications"
                        checked={settings.notifications?.email}
                        onCheckedChange={(checked) => updateSetting(["notifications", "email"], checked)}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label htmlFor="push-notifications">Push Notifications</Label>
                        <p className="text-cream/60 text-sm">Receive push notifications in your browser</p>
                      </div>
                      <Switch
                        id="push-notifications"
                        checked={settings.notifications?.push}
                        onCheckedChange={(checked) => updateSetting(["notifications", "push"], checked)}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label htmlFor="budget-alerts">Budget Alerts</Label>
                        <p className="text-cream/60 text-sm">Get notified when you're approaching your budget limits</p>
                      </div>
                      <Switch
                        id="budget-alerts"
                        checked={settings.notifications?.budgetAlerts}
                        onCheckedChange={(checked) => updateSetting(["notifications", "budgetAlerts"], checked)}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label htmlFor="expense-notifications">Expense Notifications</Label>
                        <p className="text-cream/60 text-sm">Get notified about expense changes and updates</p>
                      </div>
                      <Switch
                        id="expense-notifications"
                        checked={settings.notifications?.expenseNotifications ?? true}
                        onCheckedChange={(checked) => updateSetting(["notifications", "expenseNotifications"], checked)}
                      />
                    </div>
                  </div>
                </motion.div>
              </TabsContent>

              <TabsContent value="budgets">
                <motion.div
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

                    {/* Budget settings would go here */}
                    <div className="bg-cream/10 rounded-lg p-6 text-center">
                      <CreditCard className="h-12 w-12 mx-auto mb-4 text-cream/40" />
                      <h3 className="text-lg font-medium mb-2">Budget Management</h3>
                      <p className="text-cream/60 mb-4">
                        Set up and manage your category budgets to track your spending goals.
                      </p>
                      <Button className="bg-cream text-dark hover:bg-cream/90">Set Up Budgets</Button>
                    </div>
                  </div>
                </motion.div>
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
    </div>
  )
}

