"use client"

import { useEffect, useState, useMemo } from "react"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Area } from "recharts"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "../../components/ui/chart"
import { motion } from "framer-motion"
import { useViewport } from "../../hooks/use-mobile"

interface MonthlyTrendsChartProps {
  data: any[]
}

export function MonthlyTrendsChart({ data }: MonthlyTrendsChartProps) {
  const [animatedData, setAnimatedData] = useState<any[]>([])
  const { isMobile, isTablet } = useViewport()

  // Responsive chart configuration
  const chartConfig = useMemo(() => {
    if (isMobile) {
      return {
        height: 250,
        margin: { top: 10, right: 5, left: 0, bottom: 20 },
        tickFontSize: 10,
        yAxisWidth: 35,
        strokeWidth: 1.5,
        dotRadius: 3,
        activeDotRadius: 4,
      }
    } else if (isTablet) {
      return {
        height: 280,
        margin: { top: 10, right: 8, left: 0, bottom: 20 },
        tickFontSize: 11,
        yAxisWidth: 40,
        strokeWidth: 2,
        dotRadius: 3.5,
        activeDotRadius: 5,
      }
    } else {
      return {
        height: 300,
        margin: { top: 10, right: 10, left: 0, bottom: 20 },
        tickFontSize: 12,
        yAxisWidth: 50,
        strokeWidth: 2,
        dotRadius: 4,
        activeDotRadius: 6,
      }
    }
  }, [isMobile, isTablet])

  useEffect(() => {
    // Start with empty data for animation
    setAnimatedData([])

    // Animate data points appearing one by one
    const timer = setTimeout(() => {
      setAnimatedData(data)
    }, 400)

    return () => clearTimeout(timer)
  }, [data])

  return (
    <motion.div 
      initial={{ opacity: 0 }} 
      animate={{ opacity: 1 }} 
      transition={{ duration: 0.5 }} 
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
          <LineChart data={animatedData} margin={chartConfig.margin}>
            <defs>
              <linearGradient id="colorAmount" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="rgba(245, 245, 240, 0.8)" stopOpacity={0.8} />
                <stop offset="95%" stopColor="rgba(245, 245, 240, 0.2)" stopOpacity={0.2} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(245, 245, 240, 0.1)" />
            <XAxis
              dataKey="month"
              axisLine={false}
              tickLine={false}
              tick={{ 
                fill: "rgba(245, 245, 240, 0.6)", 
                fontSize: chartConfig.tickFontSize 
              }}
              dy={10}
              interval={isMobile ? 1 : 0}
              angle={isMobile ? -45 : 0}
              textAnchor={isMobile ? "end" : "middle"}
              height={isMobile ? 50 : 30}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ 
                fill: "rgba(245, 245, 240, 0.6)", 
                fontSize: chartConfig.tickFontSize 
              }}
              tickFormatter={(value) => isMobile ? `$${Math.round(value)}` : `$${value}`}
              width={chartConfig.yAxisWidth}
            />
            <ChartTooltip 
              content={<ChartTooltipContent />}
              labelFormatter={(value) => `Month: ${value}`}
              formatter={(value: any) => [`$${value.toLocaleString()}`, 'Amount']}
            />
            <Area
              type="monotone"
              dataKey="amount"
              stroke="rgba(245, 245, 240, 0.8)"
              strokeWidth={chartConfig.strokeWidth}
              fillOpacity={0.3}
              fill="url(#colorAmount)"
              animationDuration={1500}
              animationEasing="ease-out"
            />
            <Line
              type="monotone"
              dataKey="amount"
              stroke="rgba(245, 245, 240, 0.8)"
              strokeWidth={chartConfig.strokeWidth}
              dot={{ fill: "rgba(245, 245, 240, 0.8)", r: chartConfig.dotRadius }}
              activeDot={{ r: chartConfig.activeDotRadius, fill: "#F5F5F0" }}
              animationDuration={1500}
              animationEasing="ease-out"
            />
          </LineChart>
        </ResponsiveContainer>
      </ChartContainer>
    </motion.div>
  )
}

