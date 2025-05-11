"use client"

import { useState } from "react"
import { format, startOfWeek, addDays, addWeeks, subWeeks } from "date-fns"

// Mock data for the heatmap
const generateMockData = () => {
  const today = new Date()
  const startDate = startOfWeek(subWeeks(today, 11))
  const data: Record<string, number> = {}

  // Generate 12 weeks of data
  for (let week = 0; week < 12; week++) {
    for (let day = 0; day < 7; day++) {
      const date = addDays(addWeeks(startDate, week), day)
      const dateKey = format(date, "yyyy-MM-dd")
      // Random value between 0 and 100
      data[dateKey] = Math.floor(Math.random() * 100)
    }
  }

  return data
}

export function SpendingHeatmap() {
  const [data] = useState(generateMockData())
  const today = new Date()
  const startDate = startOfWeek(subWeeks(today, 11))

  // Generate weeks array
  const weeks = []
  for (let week = 0; week < 12; week++) {
    const weekDays = []
    for (let day = 0; day < 7; day++) {
      const date = addDays(addWeeks(startDate, week), day)
      const dateKey = format(date, "yyyy-MM-dd")
      weekDays.push({
        date,
        dateKey,
        value: data[dateKey] || 0,
      })
    }
    weeks.push(weekDays)
  }

  // Get color based on value
  const getColor = (value: number) => {
    if (value === 0) return "bg-cream/5"
    if (value < 25) return "bg-cream/10"
    if (value < 50) return "bg-cream/20"
    if (value < 75) return "bg-cream/30"
    return "bg-cream/40"
  }

  // Day labels
  const dayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

  return (
    <div className="h-[300px] overflow-auto">
      <div className="flex">
        <div className="w-8 mr-2">
          {dayLabels.map((day, index) => (
            <div key={day} className="h-5 text-xs text-cream/40 flex items-center justify-end">
              {index % 2 === 0 ? day : ""}
            </div>
          ))}
        </div>
        <div className="flex-1 overflow-x-auto">
          <div className="flex">
            {weeks.map((week, weekIndex) => (
              <div key={weekIndex} className="flex flex-col mr-1">
                {week.map((day) => (
                  <div
                    key={day.dateKey}
                    className={`h-5 w-5 rounded-sm ${getColor(day.value)} m-[1px] cursor-pointer hover:ring-1 hover:ring-cream/40`}
                    title={`${format(day.date, "MMM d, yyyy")}: $${day.value.toFixed(2)}`}
                  />
                ))}
              </div>
            ))}
          </div>
          <div className="flex justify-between mt-2 text-xs text-cream/40">
            <span>{format(startDate, "MMM d")}</span>
            <span>{format(today, "MMM d")}</span>
          </div>
        </div>
      </div>
      <div className="flex items-center justify-end mt-4">
        <div className="text-xs text-cream/60 mr-2">Less</div>
        <div className="flex">
          <div className="h-3 w-3 bg-cream/5 rounded-sm"></div>
          <div className="h-3 w-3 bg-cream/10 rounded-sm ml-1"></div>
          <div className="h-3 w-3 bg-cream/20 rounded-sm ml-1"></div>
          <div className="h-3 w-3 bg-cream/30 rounded-sm ml-1"></div>
          <div className="h-3 w-3 bg-cream/40 rounded-sm ml-1"></div>
        </div>
        <div className="text-xs text-cream/60 ml-2">More</div>
      </div>
    </div>
  )
}

