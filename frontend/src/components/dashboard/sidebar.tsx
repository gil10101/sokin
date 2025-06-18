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
} from "lucide-react"
import { useState, useEffect } from "react"
import { Avatar, AvatarFallback, AvatarImage } from "../../components/ui/avatar"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../../components/ui/tooltip"
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
        <TooltipProvider delayDuration={0}>
          <ul className="space-y-2">
            {navItems.map((item) => (
              <li key={item.href}>
                {collapsed ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
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
                    </TooltipTrigger>
                    <TooltipContent side="right">{item.label}</TooltipContent>
                  </Tooltip>
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
        </TooltipProvider>
      </nav>

      <div className="mt-auto border-t border-cream/10 p-4">
        {collapsed ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                className="flex items-center justify-center h-10 w-10 rounded-lg text-cream/60 hover:text-cream hover:bg-cream/5 transition-colors"
                onClick={handleSignOut}
              >
                <Avatar className="h-8 w-8">
                  <AvatarImage src="/placeholder.svg?height=32&width=32" alt={user?.displayName || "User"} />
                  <AvatarFallback>{user?.displayName?.charAt(0) || "U"}</AvatarFallback>
                </Avatar>
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">{user?.displayName || "User"}</TooltipContent>
          </Tooltip>
        ) : (
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <Avatar className="h-8 w-8 mr-3">
                <AvatarImage src="/placeholder.svg?height=32&width=32" alt={user?.displayName || "User"} />
                <AvatarFallback>{user?.displayName?.charAt(0) || "U"}</AvatarFallback>
              </Avatar>
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

