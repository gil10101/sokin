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
        className="hidden md:flex h-screen bg-dark border-r border-cream/10 flex-col overflow-hidden transition-all duration-300 ease-in-out"
        style={{ width: collapsed ? "80px" : "240px" }}
      />
    )
  }

  return (
    <aside
      className="hidden md:flex h-screen bg-dark border-r border-cream/10 flex-col transition-all duration-300 ease-in-out overflow-hidden"
      style={{ width: collapsed ? "80px" : "240px" }}
    >
      {/* Compact header - scales with viewport height */}
      <div className="p-2 xl:p-3 2xl:p-4 flex items-center justify-between border-b border-cream/10 h-[52px] xl:h-[60px] 2xl:h-[68px] flex-shrink-0">
        <Link href="/" className={`flex items-center font-outfit font-medium text-base xl:text-lg 2xl:text-xl transition-opacity duration-200 ${collapsed ? "opacity-0 hidden" : "opacity-100 block"} hover:opacity-80`}>
          <img src="/sokin-icon.png" alt="Sokin" className="h-6 w-6 xl:h-7 xl:w-7 2xl:h-8 2xl:w-8 mr-1.5 xl:mr-2" />
          Sokin<span className="text-[10px] xl:text-xs align-super">™</span>
        </Link>
        <Link href="/" className={`transition-opacity duration-200 ${collapsed ? "opacity-100 block" : "opacity-0 hidden"} hover:opacity-80`}>
          <img src="/sokin-icon.png" alt="Sokin" className="h-6 w-6 xl:h-7 xl:w-7 2xl:h-8 2xl:w-8" />
        </Link>
        <button
          type="button"
          onClick={() => setCollapsed(!collapsed)}
          className="h-7 w-7 xl:h-8 xl:w-8 rounded-full flex items-center justify-center text-cream/60 hover:text-cream hover:bg-cream/5 transition-colors"
        >
          <ChevronLeft className={`h-3.5 w-3.5 xl:h-4 xl:w-4 transition-transform ${collapsed ? "rotate-180" : ""}`} />
        </button>
      </div>

      {/* Compact navigation with reduced spacing */}
      <nav className="flex-1 py-2 xl:py-3 2xl:py-4 px-1.5 xl:px-2 2xl:px-3 overflow-y-auto overflow-x-hidden min-h-0">
        <TooltipPrimitive.Provider delayDuration={0}>
          <ul className="space-y-0.5 xl:space-y-1 2xl:space-y-1.5">
            {navItems.map((item) => (
              <li key={item.href}>
                {collapsed ? (
                  <TooltipPrimitive.Root>
                    <TooltipPrimitive.Trigger asChild>
                      <div>
                        <Link
                          href={item.href}
                          className={`flex items-center justify-center h-7 xl:h-8 2xl:h-9 w-full rounded-md xl:rounded-lg text-cream/60 hover:text-cream hover:bg-cream/5 transition-colors ${
                            pathname === item.href ? "bg-cream/5 text-cream" : ""
                          }`}
                        >
                          <item.icon className="h-3.5 w-3.5 xl:h-4 xl:w-4 2xl:h-[1.125rem] 2xl:w-[1.125rem]" />
                        </Link>
                      </div>
                    </TooltipPrimitive.Trigger>
                    <TooltipPrimitive.Portal>
                      <TooltipPrimitive.Content 
                        side="right" 
                        sideOffset={8}
                        className="z-50 overflow-hidden rounded-md border bg-dark border-cream/10 px-3 py-1.5 text-sm text-cream shadow-md"
                      >
                        {item.label}
                        <TooltipPrimitive.Arrow className="fill-cream/10" />
                      </TooltipPrimitive.Content>
                    </TooltipPrimitive.Portal>
                  </TooltipPrimitive.Root>
                ) : (
                  <div>
                    <Link
                      href={item.href}
                      className={`flex items-center px-1.5 xl:px-2 2xl:px-2.5 h-7 xl:h-8 2xl:h-9 rounded-md xl:rounded-lg text-cream/60 hover:text-cream hover:bg-cream/5 transition-colors ${
                        pathname === item.href ? "bg-cream/5 text-cream" : ""
                      }`}
                    >
                      <item.icon className="h-3.5 w-3.5 xl:h-4 xl:w-4 2xl:h-[1.125rem] 2xl:w-[1.125rem] mr-1.5 xl:mr-2 2xl:mr-2.5 flex-shrink-0" />
                      <span className="font-outfit text-[10px] xl:text-xs 2xl:text-sm truncate">{item.label}</span>
                    </Link>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </TooltipPrimitive.Provider>
      </nav>

      {/* Compact footer - scales with viewport height */}
      <div className="border-t border-cream/10 p-2 xl:p-2.5 2xl:p-3 flex-shrink-0 bg-dark">
        {collapsed ? (
          <TooltipPrimitive.Provider>
            <TooltipPrimitive.Root>
              <TooltipPrimitive.Trigger asChild>
                <button
                  className="flex items-center justify-center h-8 w-8 xl:h-9 xl:w-9 2xl:h-10 2xl:w-10 mx-auto rounded-md xl:rounded-lg text-cream/60 hover:text-cream hover:bg-cream/5 transition-colors"
                  onClick={handleSignOut}
                  aria-label="Sign out"
                >
                  <AvatarPrimitive.Root className="h-6 w-6 xl:h-7 xl:w-7 2xl:h-8 2xl:w-8 rounded-full flex items-center justify-center">
                    {user?.photoURL ? (
                      <AvatarPrimitive.Image src={user.photoURL} alt={user?.displayName || "User"} className="h-6 w-6 xl:h-7 xl:w-7 2xl:h-8 2xl:w-8 rounded-full object-cover" />
                    ) : null}
                    <AvatarPrimitive.Fallback className="h-6 w-6 xl:h-7 xl:w-7 2xl:h-8 2xl:w-8 rounded-full flex items-center justify-center bg-cream/10 text-cream text-xs xl:text-sm font-medium">
                      {user?.displayName?.charAt(0)?.toUpperCase() || "U"}
                    </AvatarPrimitive.Fallback>
                  </AvatarPrimitive.Root>
                </button>
              </TooltipPrimitive.Trigger>
              <TooltipPrimitive.Portal>
                <TooltipPrimitive.Content 
                  side="right" 
                  sideOffset={8}
                  className="z-50 overflow-hidden rounded-md border bg-dark border-cream/10 px-3 py-1.5 text-sm text-cream shadow-md"
                >
                  Sign out
                  <TooltipPrimitive.Arrow className="fill-cream/10" />
                </TooltipPrimitive.Content>
              </TooltipPrimitive.Portal>
            </TooltipPrimitive.Root>
          </TooltipPrimitive.Provider>
        ) : (
          <div className="flex items-center justify-between gap-1.5 xl:gap-2 min-w-0">
            <div className="flex items-center gap-1.5 xl:gap-2 min-w-0 flex-1">
              <AvatarPrimitive.Root className="h-6 w-6 xl:h-7 xl:w-7 2xl:h-8 2xl:w-8 rounded-full flex items-center justify-center flex-shrink-0">
                {user?.photoURL ? (
                  <AvatarPrimitive.Image src={user.photoURL} alt={user?.displayName || "User"} className="h-6 w-6 xl:h-7 xl:w-7 2xl:h-8 2xl:w-8 rounded-full object-cover" />
                ) : null}
                <AvatarPrimitive.Fallback className="h-6 w-6 xl:h-7 xl:w-7 2xl:h-8 2xl:w-8 rounded-full flex items-center justify-center bg-cream/10 text-cream text-xs xl:text-sm font-medium">
                  {user?.displayName?.charAt(0)?.toUpperCase() || "U"}
                </AvatarPrimitive.Fallback>
              </AvatarPrimitive.Root>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] xl:text-xs 2xl:text-sm font-medium font-outfit truncate" title={user?.displayName || "User"}>
                  {user?.displayName || "User"}
                </p>
                <p className="text-[9px] xl:text-[10px] 2xl:text-xs text-cream/60 truncate" title={user?.email || ""}>
                  {user?.email || "user@example.com"}
                </p>
              </div>
            </div>
            <button
              className="h-7 w-7 xl:h-8 xl:w-8 rounded-full flex items-center justify-center text-cream/60 hover:text-cream hover:bg-cream/5 transition-colors flex-shrink-0"
              onClick={handleSignOut}
              aria-label="Sign out"
            >
              <LogOut className="h-3 w-3 xl:h-3.5 xl:w-3.5 2xl:h-4 2xl:w-4" />
            </button>
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

