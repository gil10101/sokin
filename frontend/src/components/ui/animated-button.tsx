import { ArrowRight } from "lucide-react"
import Link from "next/link"
import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

type RenderableReactNode = ReactNode

interface AnimatedButtonProps {
  href: string
  children: RenderableReactNode
  variant?: "default" | "outline" | "ghost"
  className?: string
}

export function AnimatedButton({ href, children, variant = "default", className }: AnimatedButtonProps) {
  const baseStyles =
    "inline-flex items-center justify-center rounded-full px-6 py-3 text-sm font-medium transition-all duration-300 group"

  const variantStyles = {
    default: "bg-cream text-dark hover:bg-cream/90",
    outline: "border border-cream/20 text-cream hover:border-cream",
    ghost: "text-cream hover:bg-cream/5",
  }

  return (
    <Link href={href} className={cn(baseStyles, variantStyles[variant], className)}>
      <span>{children}</span>
      <ArrowRight className="ml-2 h-4 w-4 transform group-hover:translate-x-1 transition-transform duration-300" />
    </Link>
  )
}

