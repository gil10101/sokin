"use client"

import { cn } from "@/lib/utils"

interface LoadingSpinnerProps {
  size?: "sm" | "md" | "lg"
  className?: string
  variant?: "default" | "dots" | "pulse"
}

export function LoadingSpinner({ size = "md", className, variant = "default" }: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: "h-4 w-4 border-2",
    md: "h-8 w-8 border-2",
    lg: "h-12 w-12 border-3",
  }

  if (variant === "dots") {
    return (
      <div className="flex items-center justify-center space-x-2">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className={cn(
              "rounded-full bg-cream animate-loading-dot",
              size === "sm" ? "h-1.5 w-1.5" : size === "md" ? "h-2.5 w-2.5" : "h-3.5 w-3.5",
              className,
            )}
            style={{ animationDelay: `${i * 0.2}s` }}
          />
        ))}
      </div>
    )
  }

  if (variant === "pulse") {
    return (
      <div className="flex items-center justify-center">
        <div
          className={cn(
            "rounded-full bg-cream/20 animate-loading-pulse",
            size === "sm" ? "h-6 w-6" : size === "md" ? "h-12 w-12" : "h-16 w-16",
            className,
          )}
        >
          <div className={cn("rounded-full bg-cream h-full w-full scale-50")} />
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-center justify-center">
      <div
        className={cn(
          "animate-spin rounded-full border-t-cream border-r-transparent border-b-transparent border-l-transparent",
          sizeClasses[size],
          className,
        )}
      />
    </div>
  )
}
