"use client"

import React, { useEffect, useState, useRef, useMemo } from "react"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Cell, LabelList, RectangleProps } from "recharts"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "../../components/ui/chart"
import { MotionDiv } from "../../components/ui/dynamic-motion"
import { useViewport } from "../../hooks/use-mobile"

interface CategoryComparisonChartProps {
  data: Array<{ category: string; amount: number }>
}

export function CategoryComparisonChart({ data }: CategoryComparisonChartProps) {
  const { isMobile, isTablet } = useViewport()
  
  // Responsive chart configuration
  const chartConfig = useMemo(() => {
    if (isMobile) {
      return {
        height: 280,
        margin: { top: 10, right: 5, left: -10, bottom: 50 },
        fontSize: 9,
        barSize: 25,
        angle: -45,
      }
    } else if (isTablet) {
      return {
        height: 320,
        margin: { top: 15, right: 10, left: 0, bottom: 60 },
        fontSize: 10,
        barSize: 30,
        angle: -30,
      }
    } else {
      return {
        height: 350,
        margin: { top: 20, right: 15, left: 10, bottom: 70 },
        fontSize: 11,
        barSize: 35,
        angle: -20,
      }
    }
  }, [isMobile, isTablet])

  // Generate colors for different categories
  const getBarColor = (index: number): string => {
    const colors = [
      'rgba(245, 245, 240, 0.9)', // cream
      'rgba(245, 245, 240, 0.7)', // cream lighter
      'rgba(245, 245, 240, 0.5)', // cream even lighter
      'rgba(245, 245, 240, 0.3)', // cream very light
      'rgba(245, 245, 240, 0.8)', // cream medium
      'rgba(245, 245, 240, 0.6)', // cream medium light
    ]
    return colors[index % colors.length]
  }

  // Custom label component
  const CustomizedLabel = (props: any) => {
    const { x, y, width, value } = props
    const radius = 10
    
    return (
      <g>
        <text
          x={x + width / 2}
          y={y - radius}
          fill="rgba(245, 245, 240, 0.9)"
          textAnchor="middle"
          fontSize={isMobile ? "8" : "9"}
          dominantBaseline="middle"
        >
          ${Math.round(value)}
        </text>
      </g>
    )
  }

  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-cream/50">
        <div className="text-center">
          <div className="text-4xl mb-2">📊</div>
          <p className="text-sm">No category data available</p>
        </div>
      </div>
    )
  }

  return (
    <MotionDiv
      className="w-full"
      style={{ height: chartConfig.height }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
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
            data={data}
            margin={chartConfig.margin}
            barCategoryGap="20%"
          >
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(245, 245, 240, 0.1)" vertical={false} />
            
            <XAxis
              dataKey="category"
              axisLine={false}
              tickLine={false}
              tick={{
                fill: "rgba(245, 245, 240, 0.6)",
                fontSize: chartConfig.fontSize,
                textAnchor: "end"
              }}
              angle={chartConfig.angle}
              textAnchor="end"
              height={70}
              interval={0}
            />
            
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{
                fill: "rgba(245, 245, 240, 0.6)",
                fontSize: chartConfig.fontSize
              }}
              tickFormatter={(value) => isMobile ? `$${Math.round(value/1000)}k` : `$${value.toLocaleString()}`}
              width={isMobile ? 35 : 60}
            />
            
            <ChartTooltip
              content={<ChartTooltipContent />}
              labelFormatter={(value) => `Category: ${value}`}
              formatter={(value: number) => [`$${value.toLocaleString()}`]}
            />
            
            <Bar
              dataKey="amount"
              radius={[4, 4, 0, 0]}
              maxBarSize={chartConfig.barSize}
            >
              <LabelList content={<CustomizedLabel />} />
              {data.map((entry, index) => (
                <Cell 
                  key={`cell-${index}`} 
                  fill={getBarColor(index)} 
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartContainer>
    </MotionDiv>
  )
}