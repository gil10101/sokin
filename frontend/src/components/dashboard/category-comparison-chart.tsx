"use client"

import { useEffect, useState } from "react"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Cell, LabelList } from "recharts"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "../../components/ui/chart"
import { motion } from "framer-motion"

interface CategoryComparisonChartProps {
  data: any[]
}

export function CategoryComparisonChart({ data }: CategoryComparisonChartProps) {
  // Limit to top 5 categories for better visualization
  const topCategories = data.slice(0, 5)
  const [animatedData, setAnimatedData] = useState<any[]>([])

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

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5, delay: 0.1 }}
      className="h-[300px]"
    >
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
          <BarChart data={animatedData} layout="vertical" margin={{ top: 10, right: 10, left: 80, bottom: 20 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="rgba(245, 245, 240, 0.1)" />
            <XAxis
              type="number"
              axisLine={false}
              tickLine={false}
              tick={{ fill: "rgba(245, 245, 240, 0.6)", fontSize: 12 }}
              tickFormatter={(value) => `$${value}`}
            />
            <YAxis
              type="category"
              dataKey="category"
              axisLine={false}
              tickLine={false}
              tick={{ fill: "rgba(245, 245, 240, 0.6)", fontSize: 12 }}
              width={80}
            />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Bar dataKey="amount" radius={[0, 4, 4, 0]} animationDuration={1500} animationEasing="ease-out">
              {animatedData.map((entry, index) => {
                const opacity = 1 - index * 0.15
                return <Cell key={`cell-${index}`} fill={`rgba(245, 245, 240, ${opacity})`} />
              })}
              <LabelList
                dataKey="amount"
                position="right"
                formatter={(value: number) => `$${value.toFixed(0)}`}
                style={{ fill: "rgba(245, 245, 240, 0.7)", fontSize: 11 }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartContainer>
    </motion.div>
  )
}

