'use client'

import React, { ReactNode, Suspense, lazy, ComponentType, RefObject } from 'react'
import { useIntersectionObserver } from '../../hooks/use-intersection-observer'
import { LoadingSpinner } from './loading-spinner'

interface LazyWrapperProps {
  children: ReactNode
  fallback?: ReactNode
  rootMargin?: string
  threshold?: number
}

export function LazyWrapper({
  children,
  fallback = <div className="h-32 flex items-center justify-center"><LoadingSpinner size="sm" /></div>,
  rootMargin = '50px',
  threshold = 0.1
}: LazyWrapperProps) {
  const { elementRef, isIntersecting } = useIntersectionObserver({
    threshold,
    rootMargin,
    freezeOnceVisible: true
  })

  return (
    <div ref={elementRef as RefObject<HTMLDivElement>}>
      {isIntersecting ? (
        React.createElement(Suspense, { fallback }, children)
      ) : (
        <div className="h-32 flex items-center justify-center">
          <div className="text-cream/60 text-sm">Loading...</div>
        </div>
      )}
    </div>
  )
}

// Higher-order component for lazy loading components
export function withLazyLoading<T extends object>(
  importFunc: () => Promise<{ default: ComponentType<T> }>,
  fallback?: ReactNode
) {
  return lazy(() =>
    importFunc().then(module => ({
      default: (props: T) => (
        <LazyWrapper fallback={fallback}>
          {React.createElement(module.default, props)}
        </LazyWrapper>
      )
    }))
  )
}
