"use client"

import * as React from "react"
import { DayPicker } from "react-day-picker"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"

export type CalendarProps = React.ComponentProps<typeof DayPicker>

function Calendar({ className, ...props }: CalendarProps) {
  return (
    <DayPicker
      className={cn("p-3 rounded-md border shadow-sm", className)}
      captionLayout="dropdown"
      classNames={{
        months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
        month: "space-y-4",
        caption: "flex justify-between items-center pt-1 relative px-8",
        caption_label: "hidden",
        caption_dropdowns: "flex justify-center gap-6",
        dropdown: "bg-dark border border-cream/10 rounded-md px-3 py-2 text-cream text-sm font-medium hover:bg-cream/10 focus:bg-cream/10 focus:outline-none focus:ring-2 focus:ring-cream/20 [&>option]:bg-dark [&>option]:text-cream",
        dropdown_month: "bg-dark border border-cream/10 rounded-md px-3 py-2 text-cream text-sm font-medium hover:bg-cream/10 focus:bg-cream/10 focus:outline-none focus:ring-2 focus:ring-cream/20 [&>option]:bg-dark [&>option]:text-cream",
        dropdown_year: "bg-dark border border-cream/10 rounded-md px-3 py-2 text-cream text-sm font-medium hover:bg-cream/10 focus:bg-cream/10 focus:outline-none focus:ring-2 focus:ring-cream/20 [&>option]:bg-dark [&>option]:text-cream",
        nav: "space-x-1 flex items-center",
        nav_button: "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100 rounded-md hover:bg-cream/10 flex items-center justify-center",
        nav_button_previous: "absolute left-0 top-1/2 -translate-y-1/2",
        nav_button_next: "absolute right-0 top-1/2 -translate-y-1/2",
        table: "w-full border-collapse space-y-1",
        head_row: "flex w-full",
        head_cell: "text-muted-foreground rounded-md w-9 h-9 font-normal text-[0.8rem] flex items-center justify-center flex-shrink-0",
        row: "flex w-full mt-2",
        cell: "text-center text-sm p-0 relative flex-shrink-0 w-9 h-9 flex items-center justify-center",
        day: "h-9 w-9 p-0 font-normal rounded-md hover:bg-cream/10 hover:text-cream text-center",
        day_selected: "bg-cream text-dark hover:bg-cream/90 hover:text-dark",
        day_today: "bg-cream/20 text-cream",
        day_outside: "text-muted-foreground opacity-50",
        day_disabled: "text-muted-foreground opacity-50",
      }}
      components={{
        Chevron: ({ ...props }) => {
          if (props.orientation === "left") {
            return <ChevronLeft className="h-4 w-4" />
          }
          return <ChevronRight className="h-4 w-4" />
        },
      }}
      {...props}
    />
  )
}

Calendar.displayName = "Calendar"

export { Calendar }
