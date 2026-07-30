"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Home, CreditCard, Wallet, Repeat, BarChart3, PlusCircle, User, Settings, Menu, LogOut, Target, Calendar, TrendingUp, Building } from "lucide-react"
import { Button } from "./ui/button"
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle } from "./ui/sheet"
import { ScrollArea } from "./ui/scroll-area"
import { cn } from "@/lib/utils"
import { useAuth } from "@/contexts/auth-context"

const navigationItems = [
  {
    title: "Dashboard",
    href: "/dashboard",
    icon: Home,
  },
  {
    title: "Expenses",
    href: "/dashboard/expenses",
    icon: CreditCard,
  },
  {
    title: "Budgets",
    href: "/dashboard/budgets",
    icon: Wallet,
  },
  {
    title: "Goals",
    href: "/dashboard/goals",
    icon: Target,
  },
  {
    title: "Net Worth",
    href: "/dashboard/net-worth",
    icon: Building,
  },
  {
    title: "Bills",
    href: "/dashboard/bills",
    icon: Calendar,
  },
  {
    title: "Subscriptions",
    href: "/dashboard/subscriptions",
    icon: Repeat,
  },
  {
    title: "Analytics",
    href: "/dashboard/analytics",
    icon: BarChart3,
  },
  {
    title: "Stocks",
    href: "/dashboard/stocks",
    icon: TrendingUp,
  },
  {
    title: "Add Expense",
    href: "/dashboard/add-expense",
    icon: PlusCircle,
  },
  {
    title: "Profile",
    href: "/dashboard/profile",
    icon: User,
  },
  {
    title: "Settings",
    href: "/dashboard/settings",
    icon: Settings,
  },
]

export function MobileNav() {
  const [open, setOpen] = React.useState(false)
  const pathname = usePathname()
  const { signOut } = useAuth()

  const isActive = (href: string) =>
    href === "/dashboard" ? pathname === href : !!pathname?.startsWith(href)

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden fixed top-4 left-4 z-40 bg-dark/80 backdrop-blur-sm border border-cream/10 text-cream hover:bg-cream/5"
        >
          <Menu className="h-5 w-5" />
          <span className="sr-only">Toggle Menu</span>
        </Button>
      </SheetTrigger>
      <SheetContent 
        side="left" 
        className="w-[280px] sm:w-[300px] p-0 bg-dark border-cream/10"
      >
        <SheetHeader className="sr-only">
          <SheetTitle>Navigation Menu</SheetTitle>
        </SheetHeader>
        <div className="flex flex-col h-full">
          <div className="flex items-center justify-between p-6 border-b border-cream/10">
            <Link 
              href="/" 
              className="flex items-center font-outfit font-medium text-xl text-cream"
              onClick={() => setOpen(false)}
            >
              <img src="/sokin-icon.png" alt="Sokin" className="h-8 w-8 mr-2" />
              Sokin<span className="text-xs align-super">™</span>
            </Link>
          </div>
          
          <ScrollArea className="flex-1 py-4">
            <nav className="space-y-2 px-4">
              {navigationItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className={cn(
                    "flex items-center px-3 py-3 rounded-lg text-sm font-medium transition-colors",
                    "text-cream/60 hover:text-cream hover:bg-cream/5",
                    isActive(item.href) && "bg-cream/5 text-cream"
                  )}
                  aria-current={isActive(item.href) ? "page" : undefined}
                >
                  <item.icon className="h-5 w-5 mr-3" />
                  {item.title}
                </Link>
              ))}
            </nav>
          </ScrollArea>

          <div className="border-t border-cream/10 p-4">
            <button
              onClick={() => { setOpen(false); signOut() }}
              className="flex w-full items-center px-3 py-3 rounded-lg text-sm font-medium text-cream/60 hover:text-cream hover:bg-cream/5 transition-colors"
            >
              <LogOut className="h-5 w-5 mr-3" />
              Sign out
            </button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
} 