"use client"

/**
 * Intersection Observer based lazy loading component
 * Only loads content when it enters the viewport
 */

import { useEffect, useRef, useState } from 'react'

interface IntersectionLazyProps {
  children: React.ReactNode
  fallback?: React.ReactNode
  rootMargin?: string
  threshold?: number
  once?: boolean
}

export const IntersectionLazy = ({
  children,
  fallback = (
    <div className="flex items-center justify-center p-8 bg-muted animate-pulse rounded">
      <div className="text-sm text-muted-foreground">Loading content...</div>
    </div>
  ),
  rootMargin = '50px',
  threshold = 0.1,
  once = true
}: IntersectionLazyProps) => {
  const [isVisible, setIsVisible] = useState(false)
  const [hasLoaded, setHasLoaded] = useState(false)
  const elementRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const element = elementRef.current
    if (!element) return

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0]
        if (entry.isIntersecting) {
          setIsVisible(true)
          if (once) {
            setHasLoaded(true)
            observer.unobserve(element)
          }
        } else if (!once) {
          setIsVisible(false)
        }
      },
      {
        rootMargin,
        threshold
      }
    )

    observer.observe(element)

    return () => {
      observer.unobserve(element)
    }
  }, [rootMargin, threshold, once])

  return (
    <div ref={elementRef} className="min-h-[100px]">
      {(isVisible || hasLoaded) ? children : fallback}
    </div>
  )
}

export default IntersectionLazy
