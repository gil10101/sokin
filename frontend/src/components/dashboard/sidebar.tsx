"use client"
import Link from "next/link"
import {
  BarChart3,
  Home,
  User,
  Settings,
  PlusCircle,
  CreditCard,
  ChevronLeft,
  LogOut,
  Wallet,
  Repeat,
  Calendar,
  Target,
  TrendingUp,
  Building,
} from "lucide-react"
import { useState, useEffect } from "react"
import * as AvatarPrimitive from "@radix-ui/react-avatar"
import * as TooltipPrimitive from "@radix-ui/react-tooltip"
import { useAuth } from "../../contexts/auth-context"
import { usePathname } from "next/navigation"

interface DashboardSidebarProps {
  collapsed: boolean
  setCollapsed: (collapsed: boolean) => void
}

export function DashboardSidebar({ collapsed, setCollapsed }: DashboardSidebarProps) {
  const { user, signOut } = useAuth()
  const pathname = usePathname()
  const [mounted, setMounted] = useState(false)

  // Fix hydration issues by only rendering after mount
  useEffect(() => {
    setMounted(true)
  }, [])

  const handleSignOut = async () => {
    await signOut()
  }

  if (!mounted) {
    return (
      <aside
        className="h-screen bg-dark border-r border-cream/10 flex flex-col"
        style={{ width: collapsed ? "100px" : "200px" }}
      />
    )
  }

  return (
    <aside
      className="hidden md:flex h-screen bg-dark border-r border-cream/10 flex-col transition-all duration-300 ease-in-out"
      style={{ width: collapsed ? "100px" : "200px" }}
    >
      <div className="p-4 flex items-center justify-between border-b border-cream/10 h-[73px]">
        <Link href="/" className={`flex items-center font-outfit font-medium text-xl transition-opacity duration-200 ${collapsed ? "opacity-0 hidden" : "opacity-100 block"} hover:opacity-80 transition-opacity`}>
          <img src="/sokin-icon.png" alt="Sokin" className="h-8 w-8 mr-2" />
          Sokin<span className="text-xs align-super">™</span>
        </Link>
        <Link href="/" className={`transition-opacity duration-200 ${collapsed ? "opacity-100 block" : "opacity-0 hidden"} hover:opacity-80 transition-opacity`}>
          <img src="/sokin-icon.png" alt="Sokin" className="h-8 w-8" />
        </Link>
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="h-8 w-8 rounded-full flex items-center justify-center text-cream/60 hover:text-cream hover:bg-cream/5 transition-colors"
        >
          <ChevronLeft className={`h-4 w-4 transition-transform ${collapsed ? "rotate-180" : ""}`} />
        </button>
      </div>

      <nav className="flex-1 py-6 px-3">
        <TooltipPrimitive.Provider delayDuration={0}>
          <ul className="space-y-2">
            {navItems.map((item) => (
              <li key={item.href}>
                {collapsed ? (
                  <TooltipPrimitive.Root>
                    <TooltipPrimitive.Trigger asChild>
                      <div>
                        <Link
                          href={item.href}
                          className={`flex items-center justify-center h-10 w-10 rounded-lg text-cream/60 hover:text-cream hover:bg-cream/5 transition-colors ${
                            pathname === item.href ? "bg-cream/5 text-cream" : ""
                          }`}
                        >
                          <item.icon className="h-5 w-5" />
                        </Link>
                      </div>
                    </TooltipPrimitive.Trigger>
                    <TooltipPrimitive.Content side="right" className="z-50 overflow-hidden rounded-md border bg-dark border-cream/10 px-3 py-1.5 text-sm text-cream shadow-md">
                      {item.label}
                    </TooltipPrimitive.Content>
                  </TooltipPrimitive.Root>
                ) : (
                  <div>
                    <Link
                      href={item.href}
                      className={`flex items-center px-3 h-10 rounded-lg text-cream/60 hover:text-cream hover:bg-cream/5 transition-colors ${
                        pathname === item.href ? "bg-cream/5 text-cream" : ""
                      }`}
                    >
                      <item.icon className="h-5 w-5 mr-3" />
                      <span className="font-outfit">{item.label}</span>
                    </Link>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </TooltipPrimitive.Provider>
      </nav>

      <div className="mt-auto border-t border-cream/10 p-4">
        {collapsed ? (
          <TooltipPrimitive.Root>
            <TooltipPrimitive.Trigger asChild>
              <button
                className="flex items-center justify-center h-10 w-10 rounded-lg text-cream/60 hover:text-cream hover:bg-cream/5 transition-colors"
                onClick={handleSignOut}
              >
                <AvatarPrimitive.Root className="h-8 w-8 rounded-full flex items-center justify-center">
                  {user?.photoURL ? (
                    <AvatarPrimitive.Image src={user.photoURL} alt={user?.displayName || "User"} className="h-8 w-8 rounded-full" />
                  ) : null}
                  <AvatarPrimitive.Fallback className="h-8 w-8 rounded-full flex items-center justify-center bg-cream/10 text-cream text-sm">
                    {user?.displayName?.charAt(0) || "U"}
                  </AvatarPrimitive.Fallback>
                </AvatarPrimitive.Root>
              </button>
            </TooltipPrimitive.Trigger>
            <TooltipPrimitive.Content side="right" className="z-50 overflow-hidden rounded-md border bg-dark border-cream/10 px-3 py-1.5 text-sm text-cream shadow-md">
              {user?.displayName || "User"}
            </TooltipPrimitive.Content>
          </TooltipPrimitive.Root>
        ) : (
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <AvatarPrimitive.Root className="h-8 w-8 mr-3 rounded-full flex items-center justify-center">
                {user?.photoURL ? (
                  <AvatarPrimitive.Image src={user.photoURL} alt={user?.displayName || "User"} className="h-8 w-8 rounded-full" />
                ) : null}
                <AvatarPrimitive.Fallback className="h-8 w-8 rounded-full flex items-center justify-center bg-cream/10 text-cream text-sm">
                  {user?.displayName?.charAt(0) || "U"}
                </AvatarPrimitive.Fallback>
              </AvatarPrimitive.Root>
              <div>
                <p className="text-sm font-medium font-outfit">{user?.displayName || "User"}</p>
                <p className="text-xs text-cream/60">{user?.email || "user@example.com"}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                className="h-8 w-8 rounded-full flex items-center justify-center text-cream/60 hover:text-cream hover:bg-cream/5 transition-colors"
                onClick={handleSignOut}
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </aside>
  )
}

const navItems = [
  {
    label: "Dashboard",
    href: "/dashboard",
    icon: Home,
  },
  {
    label: "Expenses",
    href: "/dashboard/expenses",
    icon: CreditCard,
  },
  {
    label: "Budgets",
    href: "/dashboard/budgets",
    icon: Wallet,
  },
  {
    label: "Goals",
    href: "/dashboard/goals",
    icon: Target,
  },
  {
    label: "Net Worth",
    href: "/dashboard/net-worth",
    icon: Building,
  },
  {
    label: "Bills",
    href: "/dashboard/bills",
    icon: Calendar,
  },
  {
    label: "Subscriptions",
    href: "/dashboard/subscriptions",
    icon: Repeat,
  },
  {
    label: "Analytics",
    href: "/dashboard/analytics",
    icon: BarChart3,
  },
  {
    label: "Stocks",
    href: "/dashboard/stocks",
    icon: TrendingUp,
  },
  {
    label: "Add Expense",
    href: "/dashboard/add-expense",
    icon: PlusCircle,
  },
  {
    label: "Profile",
    href: "/dashboard/profile",
    icon: User,
  },
  {
    label: "Settings",
    href: "/dashboard/settings",
    icon: Settings,
  },
]

