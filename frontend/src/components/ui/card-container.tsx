"use client"

import type { ReactNode } from "react"
import { motion } from "framer-motion"
import { cn } from "@/lib/utils"

type RenderableReactNode = ReactNode

interface CardContainerProps {
  children: RenderableReactNode
  className?: string
  hoverEffect?: boolean
}

export function CardContainer({ children, className, hoverEffect = true }: CardContainerProps) {
  return (
    <motion.div
      className={cn(
        "bg-cream/5 rounded-xl border border-cream/10 p-6",
        hoverEffect && "hover:border-cream/20 transition-all duration-300",
        className,
      )}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      whileHover={hoverEffect ? { y: -3, transition: { duration: 0.2 } } : {}}
    >
      {children}
    </motion.div>
  )
}

