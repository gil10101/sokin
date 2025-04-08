"use client"

import { useEffect, useState, useRef, useMemo } from "react"
import { Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip, Area, ComposedChart } from "recharts"
import { ChartContainer } from "@/components/ui/chart"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { motion } from "framer-motion"

// Generate data based on timeframe
const generateChartData = (timeframe: string) => {
  const now = new Date()
  const data = []

  if (timeframe === "30days") {
    // Last 30 days data
    for (let i = 30; i >= 0; i -= 5) {
      const date = new Date(now)
      date.setDate(date.getDate() - i)
      data.push({
        name: `${date.toLocaleDateString("en-US", { month: "short" })} ${date.getDate()}`,
        amount: Math.floor(Math.random() * 1000) + 500,
        average: Math.floor(Math.random() * 800) + 400,
      })
    }
  } else if (timeframe === "90days") {
    // Last 90 days data
    for (let i = 90; i >= 0; i -= 15) {
      const date = new Date(now)
      date.setDate(date.getDate() - i)
      data.push({
        name: `${date.toLocaleDateString("en-US", { month: "short" })} ${date.getDate()}`,
        amount: Math.floor(Math.random() * 1500) + 300,
        average: Math.floor(Math.random() * 1200) + 250,
      })
    }
  } else {
    // Yearly data
    for (let i = 0; i < 12; i++) {
      const date = new Date(now.getFullYear(), i, 1)
      data.push({
        name: date.toLocaleDateString("en-US", { month: "short" }),
        amount: Math.floor(Math.random() * 2000) + 800,
        average: Math.floor(Math.random() * 1800) + 700,
      })
    }
  }

  return data
}

interface ExpenseChartProps {
  timeframe?: string
}

export function ExpenseChart({ timeframe = "30days" }: ExpenseChartProps) {
  const [mounted, setMounted] = useState(false)
  const [loading, setLoading] = useState(true)
  const chartRef = useRef<HTMLDivElement>(null)
  
  // Use useMemo to cache the chart data based on timeframe
  const chartData = useMemo(() => generateChartData(timeframe), [timeframe])
  
  // No more separate animatedData state that triggers re-renders

  useEffect(() => {
    setMounted(true)
    setLoading(true)

    // Simulate loading delay
    const timer = setTimeout(() => {
      setLoading(false)
    }, 500)

    return () => clearTimeout(timer)
  }, [timeframe])

  // Only handle resize without setting state
  useEffect(() => {
    if (!mounted) return

    const handleResize = () => {
      // No longer setting state here, just force repaint if needed
      if (chartRef.current) {
        // Force repaint without state update
        chartRef.current.style.display = 'none'
        void chartRef.current.offsetHeight // Force recalculation
        chartRef.current.style.display = ''
      }
    }

    window.addEventListener("resize", handleResize)
    return () => window.removeEventListener("resize", handleResize)
  }, [mounted])

  if (!mounted || loading) {
    return (
      <div className="h-[400px] flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
        >
          <LoadingSpinner size="md" />
        </motion.div>
      </div>
    )
  }

  return (
    <motion.div
      ref={chartRef}
      className="h-[400px]"
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
          average: {
            label: "Average",
            color: "hsl(var(--chart-2))",
          },
        }}
        className="h-[400px]"
      >
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
            <defs>
              <linearGradient id="colorAmount" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="rgba(245, 245, 240, 0.8)" stopOpacity={0.8} />
                <stop offset="95%" stopColor="rgba(245, 245, 240, 0.2)" stopOpacity={0.2} />
              </linearGradient>
              <linearGradient id="colorAverage" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="rgba(200, 200, 190, 0.6)" stopOpacity={0.6} />
                <stop offset="95%" stopColor="rgba(200, 200, 190, 0.1)" stopOpacity={0.1} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(245, 245, 240, 0.1)" />
            <XAxis
              dataKey="name"
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
            <Tooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  return (
                    <div className="bg-dark border border-cream/10 p-2 rounded-md shadow-md">
                      <p className="text-cream font-medium">{payload[0].payload.name}</p>
                      <div className="flex items-center mt-1">
                        <div className="h-2 w-2 rounded-full bg-cream/80 mr-1"></div>
                        <p className="text-cream text-sm">Amount: ${payload[0].value}</p>
                      </div>
                      {payload[1] && (
                        <div className="flex items-center mt-1">
                          <div className="h-2 w-2 rounded-full bg-cream/50 mr-1"></div>
                          <p className="text-cream/80 text-sm">Average: ${payload[1].value}</p>
                        </div>
                      )}
                    </div>
                  )
                }
                return null
              }}
            />
            <Area
              type="monotone"
              dataKey="average"
              stroke="rgba(200, 200, 190, 0.6)"
              strokeWidth={1}
              fillOpacity={0.2}
              fill="url(#colorAverage)"
              animationDuration={1500}
              animationEasing="ease-out"
              isAnimationActive={!loading}
            />
            <Bar
              dataKey="amount"
              fill="url(#colorAmount)"
              radius={[4, 4, 0, 0]}
              barSize={timeframe === "year" ? 20 : 30}
              animationDuration={1500}
              animationEasing="ease-out"
              isAnimationActive={!loading}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </ChartContainer>
    </motion.div>
  )
}

