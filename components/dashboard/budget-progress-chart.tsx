"use client"

import { useEffect, useState } from "react"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Cell, ResponsiveContainer, LabelList } from "recharts"
import { motion } from "framer-motion"

// Mock data for budget progress
const data = [
  { category: "Dining", budget: 500, spent: 420, percentage: 84 },
  { category: "Shopping", budget: 300, spent: 350, percentage: 117 },
  { category: "Transport", budget: 200, spent: 180, percentage: 90 },
  { category: "Utilities", budget: 400, spent: 380, percentage: 95 },
  { category: "Entertainment", budget: 250, spent: 150, percentage: 60 },
]

export function BudgetProgressChart() {
  const [animatedData, setAnimatedData] = useState<any[]>([])

  useEffect(() => {
    // Start with zero percentages for animation
    const initialData = data.map((item) => ({
      ...item,
      percentage: 0,
    }))

    setAnimatedData(initialData)

    // Animate to actual values
    const timer = setTimeout(() => {
      setAnimatedData(data)
    }, 400)

    return () => clearTimeout(timer)
  }, [])

  // Get color based on percentage
  const getColor = (percentage: number) => {
    if (percentage < 70) return "rgba(245, 245, 240, 0.6)"
    if (percentage < 90) return "rgba(245, 245, 240, 0.8)"
    if (percentage < 100) return "rgba(245, 245, 240, 1)"
    return "rgba(255, 99, 71, 0.8)" // Tomato color for over budget
  }

  return (
    <motion.div
      className="h-[300px]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5, delay: 0.2 }}
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={animatedData} layout="vertical" margin={{ top: 20, right: 50, left: 80, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="rgba(245, 245, 240, 0.1)" />
          <XAxis
            type="number"
            axisLine={false}
            tickLine={false}
            tick={{ fill: "rgba(245, 245, 240, 0.6)", fontSize: 12 }}
            domain={[0, 120]}
            tickFormatter={(value) => `${value}%`}
          />
          <YAxis
            type="category"
            dataKey="category"
            axisLine={false}
            tickLine={false}
            tick={{ fill: "rgba(245, 245, 240, 0.6)", fontSize: 12 }}
            width={80}
          />
          <Bar
            dataKey="percentage"
            radius={[0, 4, 4, 0]}
            background={{ fill: "rgba(245, 245, 240, 0.1)" }}
            animationDuration={1500}
            animationEasing="ease-out"
          >
            {animatedData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={getColor(entry.percentage)} />
            ))}
            <LabelList
              dataKey="percentage"
              position="right"
              formatter={(value: number) => `${value}%`}
              style={{ fill: "rgba(245, 245, 240, 0.8)", fontSize: 12 }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </motion.div>
  )
}

