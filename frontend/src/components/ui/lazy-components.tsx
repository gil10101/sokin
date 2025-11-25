/**
 * Lazy-loaded components for better performance
 * These components are loaded only when needed to reduce initial bundle size
 */

import dynamic from 'next/dynamic'
import { Suspense } from 'react'

// Loading component for suspense fallbacks
const LoadingSpinner = () => (
  <div className="flex items-center justify-center p-8" role="status" aria-live="polite">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" aria-hidden="true"></div>
    <span className="ml-2 text-sm text-muted-foreground">Loading...</span>
    <span className="sr-only">Loading…</span>
  </div>
)

// Error fallback component
const ErrorFallback = ({ componentName }: { componentName: string }) => (
  <div className="flex items-center justify-center p-8 text-cream/60">
    <div>Failed to load {componentName}</div>
  </div>
)

// Lazy load Three.js components (718KB reduction when not needed)
export const LazyMobileHero3DScene = dynamic(
  () => import('./mobile-hero-3d-scene').catch(() => ({
    default: () => <ErrorFallback componentName="MobileHero3DScene" />
  })),
  {
    ssr: false,
    loading: () => <LoadingSpinner />
  }
)

export const LazyScrollTriggered3DScene = dynamic(
  () => import('./scroll-triggered-3d-scene').catch(() => ({
    default: () => <ErrorFallback componentName="ScrollTriggered3DScene" />
  })),
  {
    ssr: false,
    loading: () => <LoadingSpinner />
  }
)

export const LazyTwistedTorus = dynamic(
  () => import('./twisted-torus').catch(() => ({
    default: () => <ErrorFallback componentName="TwistedTorus" />
  })),
  {
    ssr: false,
    loading: () => <LoadingSpinner />
  }
)

// Lazy load chart components (Recharts optimization)
export const LazyExpenseChart = dynamic(
  () => import('../dashboard/expense-chart').then(mod => ({ default: mod.ExpenseChart })).catch(() => ({
    default: () => <ErrorFallback componentName="ExpenseChart" />
  })),
  {
    ssr: false,
    loading: () => <LoadingSpinner />
  }
)

export const LazyBudgetProgressChart = dynamic(
  () => import('../dashboard/budget-progress-chart').then(mod => ({ default: mod.BudgetProgressChart })).catch(() => ({
    default: () => <ErrorFallback componentName="BudgetProgressChart" />
  })),
  {
    ssr: false, 
    loading: () => <LoadingSpinner />
  }
)

export const LazyMonthlyTrendsChart = dynamic(
  () => import('../dashboard/monthly-trends-chart').then(mod => ({ 
    default: mod.MonthlyTrendsChart
  })).catch(() => ({
    default: () => <ErrorFallback componentName="MonthlyTrendsChart" />
  })),
  {
    ssr: false,
    loading: () => <LoadingSpinner />
  }
)

export const LazySpendingHeatmap = dynamic(
  () => import('../dashboard/spending-heatmap').then(mod => ({ 
    default: mod.SpendingHeatmap
  })).catch(() => ({
    default: () => <ErrorFallback componentName="SpendingHeatmap" />
  })),
  {
    ssr: false,
    loading: () => <LoadingSpinner />
  }
)

export const LazyCategoryComparisonChart = dynamic(
  () => import('../dashboard/category-comparison-chart').then(mod => ({ 
    default: mod.CategoryComparisonChart
  })).catch(() => ({
    default: () => <ErrorFallback componentName="CategoryComparisonChart" />
  })),
  {
    ssr: false,
    loading: () => <LoadingSpinner />
  }
)

export const LazyStackedBarChart = dynamic(
  () => import('../dashboard/stacked-bar-chart').then(mod => ({ default: mod.StackedBarChart })).catch(() => ({
    default: () => <ErrorFallback componentName="StackedBarChart" />
  })),
  {
    ssr: false,
    loading: () => <LoadingSpinner />
  }
)

export const LazyNetWorthTrends = dynamic(
  () => import('../dashboard/net-worth-trends').then(mod => ({ default: mod.NetWorthTrends })).catch(() => ({
    default: () => <ErrorFallback componentName="NetWorthTrends" />
  })),
  {
    ssr: false,
    loading: () => <LoadingSpinner />
  }
)

// Lazy load heavy dashboard components
export const LazyAdvancedAnalytics = dynamic(
  () => import('../dashboard/advanced-analytics').then(mod => ({ default: mod.AdvancedAnalytics })).catch(() => ({
    default: () => <ErrorFallback componentName="AdvancedAnalytics" />
  })),
  {
    ssr: false,
    loading: () => <LoadingSpinner />
  }
)

export const LazyStockMarket = dynamic(
  () => import('../dashboard/stock-market').then(mod => ({ default: mod.StockMarket })).catch(() => ({
    default: () => <ErrorFallback componentName="StockMarket" />
  })),
  {
    ssr: false,
    loading: () => <LoadingSpinner />
  }
)

export const LazyReceiptScanner = dynamic(
  () => import('../dashboard/receipt-scanner').then(mod => ({ default: mod.ReceiptScanner })).catch(() => ({
    default: () => <ErrorFallback componentName="ReceiptScanner" />
  })),
  {
    ssr: false,
    loading: () => <LoadingSpinner />
  }
)

// Lazy load animation components (Framer Motion optimization)
export const LazyDynamicMotion = dynamic(
  () => import('../ui/dynamic-motion').then(mod => ({ default: mod.MotionDiv })).catch(() => ({
    default: () => <div>Failed to load motion component</div>
  })),
  {
    ssr: false,
    loading: () => <div className="animate-pulse bg-muted h-20 w-full rounded" />
  }
)

// Wrapper component for lazy loading with error boundaries
interface LazyWrapperProps {
  children: React.ReactNode
  fallback?: React.ReactNode
}

export const LazyWrapper = ({ children, fallback = <LoadingSpinner /> }: LazyWrapperProps) => (
  <Suspense fallback={fallback}>
    {children}
  </Suspense>
)

// IntersectionLazy component is imported directly where needed

/**
 * Usage Examples:
 * 
 * // Instead of direct import:
 * import { ExpenseChart } from '../dashboard/expense-chart'
 * 
 * // Use lazy version:
 * import { LazyExpenseChart } from './lazy-components'
 * 
 * // In component:
 * <LazyWrapper>
 *   <LazyExpenseChart />
 * </LazyWrapper>
 */