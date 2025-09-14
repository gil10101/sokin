"use client"

/**
 * Lightweight chart alternatives to Recharts
 * Reduces bundle size by 200-400KB for simple visualizations
 */

import React, { useMemo } from 'react'
import { motion } from 'framer-motion'

interface DataPoint {
  name: string
  amount: number
  category?: string
  percentage?: number
}

interface LightweightBarChartProps {
  data: DataPoint[]
  height?: number
  color?: string
  showValues?: boolean
  className?: string
}

/**
 * Lightweight bar chart using pure CSS - replaces Recharts BarChart
 * Size: ~2KB vs Recharts ~200KB
 */
export const LightweightBarChart: React.FC<LightweightBarChartProps> = ({
  data,
  height = 200,
  color = '#3b82f6',
  showValues = true,
  className = ''
}) => {
  const maxValue = useMemo(() => {
    if (data.length === 0) return 0;
    const max = Math.max(...data.map(d => d.amount));
    return isFinite(max) ? max : 0;
  }, [data]);
  
  const safeMax = Math.max(1, maxValue);
  const safeHeight = Math.max(0, height - 40);

  return (
    <div className={`w-full ${className}`} style={{ height }}>
      <div className="flex items-end justify-between gap-1 h-full">
        {data.map((item, index) => {
          const barHeight = Math.max(0, (item.amount / safeMax) * safeHeight)
          
          return (
            <motion.div
              key={item.name}
              className="flex-1 flex flex-col items-center justify-end"
              initial={{ height: 0 }}
              animate={{ height: barHeight }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
            >
              <div className="relative group w-full">
                <div
                  className="w-full rounded-t-sm transition-opacity hover:opacity-80 cursor-pointer"
                  style={{ 
                    height: barHeight,
                    backgroundColor: color,
                    minHeight: item.amount > 0 ? '4px' : '0px'
                  }}
                />
                
                {/* Tooltip */}
                <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-gray-800 text-white text-xs py-1 px-2 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                  ${item.amount.toFixed(2)}
                </div>

                {showValues && item.amount > 0 && (
                  <div className="absolute -top-6 left-1/2 transform -translate-x-1/2 text-xs text-gray-600 opacity-0 group-hover:opacity-100">
                    ${item.amount.toFixed(0)}
                  </div>
                )}
              </div>
              
              <div className="text-xs text-gray-500 mt-2 text-center truncate w-full">
                {item.name.length > 8 ? `${item.name.slice(0, 8)}...` : item.name}
              </div>
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}

interface LightweightPieChartProps {
  data: DataPoint[]
  size?: number
  showLegend?: boolean
  className?: string
}

/**
 * Lightweight pie chart using CSS conic-gradient - replaces Recharts PieChart
 * Size: ~1KB vs Recharts ~200KB
 */
export const LightweightPieChart: React.FC<LightweightPieChartProps> = ({
  data,
  size = 200,
  showLegend = true,
  className = ''
}) => {
  const colors = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#6b7280']
  
  const total = useMemo(() => data.reduce((sum, item) => sum + item.amount, 0), [data])
  
  const segments = useMemo(() => {
    // Guard against division by zero
    if (total === 0) {
      return data.map((item, index) => ({
        ...item,
        percentage: 0,
        startAngle: 0,
        endAngle: 0,
        color: colors[index % colors.length]
      }))
    }
    
    let currentAngle = 0
    return data.map((item, index) => {
      const percentage = (item.amount / total) * 100
      const angle = (item.amount / total) * 360
      const segment = {
        ...item,
        percentage,
        startAngle: currentAngle,
        endAngle: currentAngle + angle,
        color: colors[index % colors.length]
      }
      currentAngle += angle
      return segment
    })
  }, [data, total])

  const conicGradient = total === 0 
    ? colors[0] || '#e5e7eb'  // Fallback color when no data
    : segments.map(segment => 
        `${segment.color} ${segment.startAngle}deg ${segment.endAngle}deg`
      ).join(', ')

  return (
    <div className={`flex items-center gap-4 ${className}`}>
      <div
        className="rounded-full relative"
        style={{
          width: size,
          height: size,
          background: `conic-gradient(${conicGradient})`
        }}
      >
        <div 
          className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-white rounded-full flex items-center justify-center"
          style={{
            width: size * 0.4,
            height: size * 0.4
          }}
        >
          <span className="text-sm font-medium text-gray-700">${total.toFixed(0)}</span>
        </div>
      </div>

      {showLegend && (
        <div className="flex flex-col gap-2">
          {segments.map((segment, index) => (
            <div key={index} className="flex items-center gap-2">
              <div 
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: segment.color }}
              />
              <span className="text-sm text-gray-600">
                {segment.name} ({segment.percentage.toFixed(1)}%)
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

interface LightweightLineChartProps {
  data: DataPoint[]
  height?: number
  color?: string
  showDots?: boolean
  className?: string
}

/**
 * Lightweight line chart using SVG - replaces Recharts LineChart
 * Size: ~3KB vs Recharts ~200KB
 */
export const LightweightLineChart: React.FC<LightweightLineChartProps> = ({
  data,
  height = 200,
  color = '#3b82f6',
  showDots = true,
  className = ''
}) => {
  const { safeMax, safeMin, points, shouldRender } = useMemo(() => {
    if (data.length === 0) {
      return { safeMax: 0, safeMin: 0, points: [], shouldRender: false };
    }
    
    const amounts = data.map(d => d.amount);
    const max = Math.max(...amounts);
    const min = Math.min(...amounts);
    
    const safeMax = isFinite(max) ? max : 0;
    const safeMin = isFinite(min) ? min : 0;
    const range = safeMax - safeMin;
    
    // Only render if we have valid data and meaningful range
    const shouldRender = data.length >= 2 && range > 0 && isFinite(range);
    
    let calculatedPoints: Array<{ x: number; y: number } & DataPoint> = [];
    
    if (shouldRender) {
      calculatedPoints = data.map((item, index) => {
        const x = (index / (data.length - 1)) * 100;
        const y = 100 - ((item.amount - safeMin) / range) * 100;
        return { x, y, ...item };
      });
    }
    
    return { safeMax, safeMin, points: calculatedPoints, shouldRender };
  }, [data]);

  if (!shouldRender) {
    return (
      <div className={`w-full flex items-center justify-center ${className}`} style={{ height }}>
        <div className="text-gray-500 text-sm">
          {data.length === 0 ? 'No data available' : 'Insufficient data for chart'}
        </div>
      </div>
    );
  }

  const pathData = points.map((point, index) => 
    `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`
  ).join(' ')

  return (
    <div className={`w-full ${className}`} style={{ height }}>
      <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
        {/* Grid lines */}
        <defs>
          <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
            <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#f3f4f6" strokeWidth="0.5"/>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" />

        {/* Area fill */}
        <path
          d={`${pathData} L 100 100 L 0 100 Z`}
          fill={color}
          fillOpacity="0.1"
        />

        {/* Line */}
        <path
          d={pathData}
          fill="none"
          stroke={color}
          strokeWidth="2"
          vectorEffect="non-scaling-stroke"
        />

        {/* Dots */}
        {showDots && points.map((point, index) => (
          <circle
            key={index}
            cx={point.x}
            cy={point.y}
            r="2"
            fill={color}
            vectorEffect="non-scaling-stroke"
          />
        ))}
      </svg>

      {/* Labels */}
      <div className="flex justify-between mt-2">
        {data.map((item, index) => (
          <div key={index} className="text-xs text-gray-500 text-center">
            {item.name.length > 6 ? `${item.name.slice(0, 6)}...` : item.name}
          </div>
        ))}
      </div>
    </div>
  )
}

/**
 * Usage Examples:
 * 
 * // Simple bar chart
 * <LightweightBarChart data={budgetData} color="#10b981" />
 * 
 * // Pie chart with legend
 * <LightweightPieChart data={categoryData} showLegend />
 * 
 * // Line chart for trends
 * <LightweightLineChart data={trendData} showDots />
 */
