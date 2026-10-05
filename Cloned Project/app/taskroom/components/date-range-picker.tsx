"use client"

import * as React from "react"

import { cn } from "@/lib/utils"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent } from "@/components/ui/popover"

export function CalendarDateRangePicker({ className }: React.HTMLAttributes<HTMLDivElement>) {
  const [date, setDate] = React.useState<Date>()

  return (
    <div className={cn("grid gap-2", className)}>
      <Popover>
        <PopoverContent className="w-auto p-0" align="end">
          <Calendar initialFocus mode="single" defaultMonth={date} selected={date} onSelect={setDate} />
        </PopoverContent>
      </Popover>
    </div>
  )
}
