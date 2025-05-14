"use client"

import { useEffect, useState } from "react"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Area } from "recharts"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "../../components/ui/chart"
import { motion } from "framer-motion"

interface MonthlyTrendsChartProps {
  data: any[]
}

export function MonthlyTrendsChart({ data }: MonthlyTrendsChartProps) {
  const [animatedData, setAnimatedData] = useState<any[]>([])

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
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }} className="h-[300px]">
      <ChartContainer
        config={{
          amount: {
            label: "Amount",
            color: "hsl(var(--chart-1))",
          },
        }}
        className="h-[300px]"
      >
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={animatedData} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
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
              tick={{ fill: "rgba(245, 245, 240, 0.6)", fontSize: 12 }}
              dy={10}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fill: "rgba(245, 245, 240, 0.6)", fontSize: 12 }}
              tickFormatter={(value) => `$${value}`}
            />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Area
              type="monotone"
              dataKey="amount"
              stroke="rgba(245, 245, 240, 0.8)"
              strokeWidth={2}
              fillOpacity={0.3}
              fill="url(#colorAmount)"
              animationDuration={1500}
              animationEasing="ease-out"
            />
            <Line
              type="monotone"
              dataKey="amount"
              stroke="rgba(245, 245, 240, 0.8)"
              strokeWidth={2}
              dot={{ fill: "rgba(245, 245, 240, 0.8)", r: 4 }}
              activeDot={{ r: 6, fill: "#F5F5F0" }}
              animationDuration={1500}
              animationEasing="ease-out"
            />
          </LineChart>
        </ResponsiveContainer>
      </ChartContainer>
    </motion.div>
  )
}

