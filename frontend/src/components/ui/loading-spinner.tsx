"use client"

import { cn } from "../../../../lib/utils"
import { motion } from "framer-motion"

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
          <motion.div
            key={i}
            className={cn(
              "rounded-full bg-cream",
              size === "sm" ? "h-1.5 w-1.5" : size === "md" ? "h-2.5 w-2.5" : "h-3.5 w-3.5",
              className,
            )}
            initial={{ opacity: 0.3 }}
            animate={{ opacity: [0.3, 1, 0.3] }}
            transition={{
              duration: 1.2,
              repeat: Number.POSITIVE_INFINITY,
              delay: i * 0.2,
              ease: "easeInOut",
            }}
          />
        ))}
      </div>
    )
  }

  if (variant === "pulse") {
    return (
      <div className="flex items-center justify-center">
        <motion.div
          className={cn(
            "rounded-full bg-cream/20",
            size === "sm" ? "h-6 w-6" : size === "md" ? "h-12 w-12" : "h-16 w-16",
            className,
          )}
          initial={{ opacity: 0.6, scale: 0.8 }}
          animate={{
            opacity: [0.6, 0.4, 0.6],
            scale: [0.8, 1.2, 0.8],
          }}
          transition={{
            duration: 1.5,
            repeat: Number.POSITIVE_INFINITY,
            ease: "easeInOut",
          }}
        >
          <div className={cn("rounded-full bg-cream h-full w-full scale-50")} />
        </motion.div>
      </div>
    )
  }

  return (
    <div className="flex items-center justify-center">
      <motion.div
        className={cn(
          "animate-spin rounded-full border-t-cream border-r-transparent border-b-transparent border-l-transparent",
          sizeClasses[size],
          className,
        )}
        initial={{ opacity: 0, rotate: 0 }}
        animate={{ opacity: 1, rotate: 360 }}
        transition={{
          duration: 1,
          repeat: Number.POSITIVE_INFINITY,
          ease: "linear",
        }}
      />
    </div>
  )
}

