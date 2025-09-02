'use client'

import { useEffect, useState } from 'react'

interface PerformanceMetrics {
  fcp: number | null // First Contentful Paint
  lcp: number | null // Largest Contentful Paint
  fid: number | null // First Input Delay
  cls: number | null // Cumulative Layout Shift
  ttfb: number | null // Time to First Byte
  domContentLoaded: number | null
  loadComplete: number | null
}

export function PerformanceMonitor() {
  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    fcp: null,
    lcp: null,
    fid: null,
    cls: null,
    ttfb: null,
    domContentLoaded: null,
    loadComplete: null,
  })

  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    // Only enable when explicitly enabled via environment variable
    const enablePerformanceMonitor = process.env.NEXT_PUBLIC_ENABLE_PERFORMANCE_MONITOR === 'true'
    if (!enablePerformanceMonitor) {
      return
    }

    setIsVisible(true)

    // Web Vitals tracking
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        switch (entry.name) {
          case 'first-contentful-paint':
            setMetrics(prev => ({ ...prev, fcp: entry.startTime }))
            break
          case 'largest-contentful-paint':
            setMetrics(prev => ({ ...prev, lcp: entry.startTime }))
            break
          case 'first-input': {
            const firstInputEntry = entry as PerformanceEventTiming
            setMetrics(prev => ({ ...prev, fid: firstInputEntry.processingStart - entry.startTime }))
            break
          }
          case 'layout-shift': {
            const layoutShiftEntry = entry as PerformanceEntry & { value: number }
            setMetrics(prev => ({
              ...prev,
              cls: (prev.cls || 0) + layoutShiftEntry.value
            }))
            break
          }
        }
      }
    })

    try {
      observer.observe({ entryTypes: ['paint', 'largest-contentful-paint', 'first-input', 'layout-shift'] })
    } catch (e) {
      // Performance monitoring not fully supported - graceful degradation
    }

    // Navigation timing
    const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming
    if (navigation) {
      setMetrics(prev => ({
        ...prev,
        ttfb: navigation.responseStart - navigation.requestStart,
        domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
        loadComplete: navigation.loadEventEnd - navigation.loadEventStart,
      }))
    }

    // Listen for additional metrics
    const handleLoad = () => {
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming
      if (navigation) {
        setMetrics(prev => ({
          ...prev,
          loadComplete: navigation.loadEventEnd - navigation.loadEventStart,
        }))
      }
    }

    window.addEventListener('load', handleLoad)

    return () => {
      observer.disconnect()
      window.removeEventListener('load', handleLoad)
    }
  }, [])

  if (!isVisible) return null

  const formatTime = (time: number | null) => time ? `${time.toFixed(2)}ms` : 'N/A'
  const formatScore = (value: number | null, good: number, poor: number) => {
    if (value === null) return 'N/A'
    if (value <= good) return '🟢 Good'
    if (value <= poor) return '🟡 Needs improvement'
    return '🔴 Poor'
  }

  return (
    <div className="fixed bottom-4 right-4 bg-dark border border-cream/10 rounded-lg p-4 shadow-lg z-50 max-w-sm">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-cream">Performance Monitor</h3>
        <button
          onClick={() => setIsVisible(false)}
          className="text-cream/60 hover:text-cream text-xs"
        >
          ✕
        </button>
      </div>

      <div className="space-y-2 text-xs">
        <div className="flex justify-between">
          <span className="text-cream/60">FCP:</span>
          <span className="text-cream">{formatTime(metrics.fcp)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-cream/60">LCP:</span>
          <span className="text-cream">{formatScore(metrics.lcp, 2500, 4000)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-cream/60">FID:</span>
          <span className="text-cream">{formatScore(metrics.fid, 100, 300)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-cream/60">CLS:</span>
          <span className="text-cream">{formatScore(metrics.cls, 0.1, 0.25)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-cream/60">TTFB:</span>
          <span className="text-cream">{formatTime(metrics.ttfb)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-cream/60">DOM Ready:</span>
          <span className="text-cream">{formatTime(metrics.domContentLoaded)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-cream/60">Load Complete:</span>
          <span className="text-cream">{formatTime(metrics.loadComplete)}</span>
        </div>
      </div>

      <div className="mt-3 pt-3 border-t border-cream/10">
        <button
          onClick={() => {
            const report = {
              timestamp: new Date().toISOString(),
              url: window.location.href,
              userAgent: navigator.userAgent,
              ...metrics
            }
            // Performance report generated - sent to analytics service in production
            // TODO: Integrate with analytics service (Sentry, LogRocket, etc.)
          }}
          className="text-xs bg-cream/10 hover:bg-cream/20 text-cream px-2 py-1 rounded"
        >
          Log Report
        </button>
      </div>
    </div>
  )
}
