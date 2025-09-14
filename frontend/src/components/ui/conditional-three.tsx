"use client"

/**
 * Conditional Three.js loading system
 * Only loads Three.js when 3D components are actually needed
 * Reduces initial bundle by 718KB
 */

import React, { useState, useEffect, useCallback, useId, useRef } from 'react'
import dynamic from 'next/dynamic'

interface ConditionalThreeProps {
  children: React.ReactNode
  fallback?: React.ReactNode
  loadOnInteraction?: boolean
  loadOnScroll?: boolean
  containerId?: string
}

// Track if Three.js has been loaded globally
let threeJsLoaded = false
let threeJsPromise: Promise<void> | null = null

/**
 * Preload Three.js only when needed
 */
const preloadThreeJs = (): Promise<void> => {
  if (threeJsLoaded) {
    return Promise.resolve()
  }

  if (threeJsPromise) {
    return threeJsPromise
  }

  threeJsPromise = import('@react-three/fiber')
    .then(() => import('three'))
    .then(() => {
      threeJsLoaded = true
    })
    .catch(error => {
      console.warn('Failed to preload Three.js:', error)
      // Clear promise and rethrow error so handleLoad can handle the rejection
      threeJsPromise = null
      throw error
    })

  return threeJsPromise
}

/**
 * Conditional Three.js loader component
 * Only loads Three.js when the component becomes visible or user interacts
 */
export const ConditionalThree: React.FC<ConditionalThreeProps> = ({
  children,
  fallback,
  loadOnInteraction = true,
  loadOnScroll = false,
  containerId
}) => {
  const [shouldLoad, setShouldLoad] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const generatedId = useId()
  const uniqueId = containerId || `three-container-${generatedId}`

  const handleLoad = useCallback(async () => {
    if (shouldLoad || isLoading) return

    setIsLoading(true)
    setError(null)

    try {
      await preloadThreeJs()
      setShouldLoad(true)
    } catch (error) {
      setError('Failed to load 3D visualization')
      console.error('Error loading Three.js:', error)
    } finally {
      setIsLoading(false)
    }
  }, [shouldLoad, isLoading])

  // Intersection observer for scroll-based loading
  useEffect(() => {
    if (!loadOnScroll) return

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0]
        if (entry.isIntersecting && !shouldLoad && !isLoading) {
          handleLoad()
        }
      },
      { threshold: 0.1 }
    )

    if (containerRef.current) {
      observer.observe(containerRef.current)
    }

    return () => observer.disconnect()
  }, [loadOnScroll, shouldLoad, isLoading, handleLoad])

  if (error) {
    return (
      <div className="flex items-center justify-center p-8 bg-red-50 rounded-lg">
        <div className="text-center">
          <div className="text-red-500 text-sm mb-2">{error}</div>
          <button 
            className="px-4 py-2 bg-red-500 text-white rounded-lg text-sm hover:bg-red-600 transition-colors"
            onClick={() => {
              setError(null)
              handleLoad()
            }}
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  // Default fallback component
  const defaultFallback = (
    <div className="flex items-center justify-center p-8 bg-gradient-to-br from-blue-50 to-purple-50 rounded-lg">
      <div className="text-center">
        <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-500 rounded-lg mb-4 mx-auto animate-pulse" />
        <p className="text-sm text-gray-600">Interactive 3D visualization</p>
        <button 
          className="mt-2 px-4 py-2 bg-blue-500 text-white rounded-lg text-sm hover:bg-blue-600 transition-colors"
          onClick={handleLoad}
        >
          Load 3D View
        </button>
      </div>
    </div>
  )

  if (!shouldLoad) {
    return (
      <div 
        ref={containerRef}
        id={uniqueId}
        onClick={loadOnInteraction ? handleLoad : undefined}
        className={loadOnInteraction ? "cursor-pointer" : ""}
      >
        {isLoading ? (
          <div className="flex items-center justify-center p-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
            <span className="ml-2 text-sm text-gray-600">Loading 3D...</span>
          </div>
        ) : (
          fallback || defaultFallback
        )}
      </div>
    )
  }

  return <>{children}</>
}

/**
 * Hook to preload Three.js in anticipation of use
 */
export const usePreloadThree = () => {
  const [isPreloaded, setIsPreloaded] = useState(threeJsLoaded)

  const preload = async () => {
    try {
      await preloadThreeJs()
      setIsPreloaded(true)
    } catch (error) {
      console.error('Failed to preload Three.js:', error)
    }
  }

  return { isPreloaded, preload }
}

/**
 * Optimized Three.js component wrapper
 * Only loads the Canvas when actually needed
 */
export const OptimizedCanvas = dynamic(
  () => import('@react-three/fiber').then(mod => ({ default: mod.Canvas })),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center h-64 bg-gradient-to-br from-gray-100 to-gray-200 rounded-lg">
        <div className="animate-pulse text-gray-500">Loading 3D Canvas...</div>
      </div>
    )
  }
)

/**
 * Usage Examples:
 * 
 * // Conditional loading with interaction
 * <ConditionalThree loadOnInteraction>
 *   <Canvas>
 *     <MyThreeJSScene />
 *   </Canvas>
 * </ConditionalThree>
 * 
 * // Load when scrolled into view
 * <ConditionalThree loadOnScroll>
 *   <OptimizedCanvas>
 *     <ThreeDVisualization />
 *   </OptimizedCanvas>
 * </ConditionalThree>
 * 
 * // Preload in anticipation
 * const { preload } = usePreloadThree()
 * useEffect(() => {
 *   // Preload when user hovers over 3D section
 *   document.getElementById('3d-section')?.addEventListener('mouseenter', preload)
 * }, [])
 */
