"use client"

import React, { useEffect, useState, useRef, useMemo } from "react"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Cell, LabelList, RectangleProps } from "recharts"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "../../components/ui/chart"
import { motion } from "framer-motion"
import { useViewport } from "../../hooks/use-mobile"

interface CategoryComparisonChartProps {
  data: Array<{ category: string; amount: number }>
}

export function CategoryComparisonChart({ data }: CategoryComparisonChartProps) {
  const { isMobile, isTablet } = useViewport()
  
  // Show all categories (no limit)
  const topCategories = data
  const [animatedData, setAnimatedData] = useState<Array<{ category: string; amount: number }>>([])
  const [hoverIndex, setHoverIndex] = useState<number | null>(null)

  // Responsive chart configuration - adjust height based on number of categories
  const chartConfig = useMemo(() => {
    const categoryCount = topCategories.length
    const baseHeight = isMobile ? 40 : 50 // Height per category
    const minHeight = isMobile ? 200 : 250 // Minimum height
    const calculatedHeight = Math.max(minHeight, categoryCount * baseHeight + 60) // +60 for margins
    
    if (isMobile) {
      return {
        height: calculatedHeight,
        margin: { top: 10, right: 5, left: 60, bottom: 20 },
        tickFontSize: 10,
        yAxisWidth: 60,
        showLabels: false,
      }
    } else if (isTablet) {
      return {
        height: calculatedHeight,
        margin: { top: 10, right: 8, left: 70, bottom: 20 },
        tickFontSize: 11,
        yAxisWidth: 70,
        showLabels: true,
      }
    } else {
      return {
        height: calculatedHeight,
        margin: { top: 10, right: 10, left: 80, bottom: 20 },
        tickFontSize: 12,
        yAxisWidth: 80,
        showLabels: true,
      }
    }
  }, [isMobile, isTablet, topCategories.length])

  useEffect(() => {
    // Start with zero values for animation
    const initialData = topCategories.map((item) => ({
      ...item,
      amount: 0,
    }))

    setAnimatedData(initialData)

    // Animate to actual values
    const timer = setTimeout(() => {
      setAnimatedData(topCategories)
    }, 400)

    return () => clearTimeout(timer)
  }, [data])

  const CustomCursor = (props: RectangleProps) => {
    const { x, y, width, height } = props;

    return (
      <rect
        x={x || 0}
        y={(y || 0) - 5}
        width="100%"
        height={(height || 0) + 10}
        fill="#353535"
        fillOpacity={0.9}
      />
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5, delay: 0.1 }}
      className="w-full"
      style={{ height: chartConfig.height }}
    >
      <ChartContainer
        config={{
          amount: {
            label: "Amount",
            color: "hsl(var(--chart-1))",
          },
        }}
        className="w-full"
        style={{ height: chartConfig.height }}
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart 
            data={animatedData} 
            layout="vertical" 
            margin={chartConfig.margin}
            onMouseLeave={() => setHoverIndex(null)}
          >
            <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="rgba(245, 245, 240, 0.1)" />
            <XAxis
              type="number"
              axisLine={false}
              tickLine={false}
              tick={{ fill: "rgba(245, 245, 240, 0.6)", fontSize: chartConfig.tickFontSize }}
              tickFormatter={(value) => isMobile ? `$${Math.round(value / 1000)}k` : `$${value}`}
            />
            <YAxis
              type="category"
              dataKey="category"
              axisLine={false}
              tickLine={false}
              tick={{ fill: "rgba(245, 245, 240, 0.6)", fontSize: chartConfig.tickFontSize }}
              width={chartConfig.yAxisWidth}
              tickFormatter={(value) => isMobile && value.length > 8 ? `${value.substring(0, 8)}...` : value}
            />
            <ChartTooltip 
              content={<ChartTooltipContent />} 
              cursor={<CustomCursor />}
              formatter={(value: number) => [`$${value.toLocaleString()}`]}
              labelFormatter={(value) => `Category: ${value}`}
            />
            <Bar 
              dataKey="amount" 
              radius={[0, 4, 4, 0]} 
              animationDuration={1500} 
              animationEasing="ease-out"
            >
              {animatedData.map((entry, index) => {
                // Create a more visible opacity gradient that doesn't go below 0.3
                const minOpacity = 0.3;
                const maxOpacity = 1;
                const opacityRange = maxOpacity - minOpacity;
                const totalCategories = animatedData.length;
                
                // Calculate opacity to ensure all bars are visible
                const opacity = totalCategories === 1 
                  ? maxOpacity 
                  : maxOpacity - (index / (totalCategories - 1)) * opacityRange;
                
                return (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={`rgba(245, 245, 240, ${Math.max(opacity, minOpacity)})`}
                    onMouseEnter={() => setHoverIndex(index)}
                  />
                )
              })}
              {chartConfig.showLabels && (
                <LabelList
                  dataKey="amount"
                  position="right"
                  formatter={(value: number) => `$${value.toFixed(0)}`}
                  style={{ fill: "rgba(245, 245, 240, 0.7)", fontSize: 11 }}
                />
              )}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartContainer>
    </motion.div>
  )
}

