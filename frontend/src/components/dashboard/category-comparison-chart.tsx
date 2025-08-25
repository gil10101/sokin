"use client"

import { useEffect, useState, useRef, useMemo } from "react"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Cell, LabelList, RectangleProps } from "recharts"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "../../components/ui/chart"
import { motion } from "framer-motion"
import { useViewport } from "../../hooks/use-mobile"

interface CategoryComparisonChartProps {
  data: any[]
}

export function CategoryComparisonChart({ data }: CategoryComparisonChartProps) {
  const { isMobile, isTablet } = useViewport()
  
  // Limit to top categories based on screen size
  const topCategories = data.slice(0, isMobile ? 4 : 5)
  const [animatedData, setAnimatedData] = useState<any[]>([])
  const [hoverIndex, setHoverIndex] = useState<number | null>(null)

  // Responsive chart configuration
  const chartConfig = useMemo(() => {
    if (isMobile) {
      return {
        height: 250,
        margin: { top: 10, right: 5, left: 60, bottom: 20 },
        tickFontSize: 10,
        yAxisWidth: 60,
        showLabels: false,
      }
    } else if (isTablet) {
      return {
        height: 280,
        margin: { top: 10, right: 8, left: 70, bottom: 20 },
        tickFontSize: 11,
        yAxisWidth: 70,
        showLabels: true,
      }
    } else {
      return {
        height: 300,
        margin: { top: 10, right: 10, left: 80, bottom: 20 },
        tickFontSize: 12,
        yAxisWidth: 80,
        showLabels: true,
      }
    }
  }, [isMobile, isTablet])

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

  const CustomCursor = (props: any) => {
    const { x, y, width, height, stroke } = props;
    
    return (
      <rect
        x={x}
        y={y - 5}
        width="100%"
        height={height + 10}
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
              formatter={(value: any) => [`$${value.toLocaleString()}`]}
              labelFormatter={(value) => `Category: ${value}`}
            />
            <Bar 
              dataKey="amount" 
              radius={[0, 4, 4, 0]} 
              animationDuration={1500} 
              animationEasing="ease-out"
            >
              {animatedData.map((entry, index) => {
                const opacity = 1 - index * 0.15;
                
                return (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={`rgba(245, 245, 240, ${opacity})`}
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

