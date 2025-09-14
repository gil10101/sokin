"use client"

import type { ReactNode } from "react"
import { useState, useEffect } from "react"
import { cn } from "@/lib/utils"
import { MotionDiv, fadeInUp } from "./dynamic-motion"

interface MotionContainerProps {
  children: ReactNode
  className?: string
  delay?: number
}

export function MotionContainer({ children, className, delay = 0 }: MotionContainerProps) {
  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => {
    setIsMounted(true)
  }, [])

  if (!isMounted) {
    return <div className={cn("focus-visible:outline-none", className)}>{children as React.ReactNode}</div>
  }

  return (
    <MotionDiv
      className={cn("focus-visible:outline-none", className)}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay }}
      exit={{ opacity: 0, y: 20 }}
    >
      {children as React.ReactNode}
    </MotionDiv>
  )
}

