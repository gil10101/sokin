import { ArrowUpRight, ArrowDownRight } from "lucide-react"

interface MetricCardProps {
  title: string
  value: string
  secondaryValue?: string
  change?: string
  trend?: "up" | "down" | "neutral"
  period?: string
  icon: React.ReactElement
}

export function MetricCard({ title, value, secondaryValue, change, trend, period, icon }: MetricCardProps) {
  return (
    <div className="bg-cream/5 rounded-xl border border-cream/10 p-5 hover:bg-cream/10 transition-colors">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm text-cream/60 font-outfit">{title}</h3>
        <div className="h-8 w-8 rounded-full bg-cream/5 flex items-center justify-center">

          {icon}
        </div>
      </div>
      <div className="space-y-1">
        <p className="text-2xl font-medium font-outfit">{value}</p>
        {secondaryValue && <p className="text-sm text-cream/60">{secondaryValue}</p>}
        {change && (
          <div className="flex items-center">
            <span className={`text-sm flex items-center ${
              trend === "up" ? "text-red-400" : 
              trend === "down" ? "text-green-400" : 
              "text-cream/60"
            }`}>
              {trend === "up" ? (
                <ArrowUpRight className="h-3 w-3 mr-1" />
              ) : trend === "down" ? (
                <ArrowDownRight className="h-3 w-3 mr-1" />
              ) : (
                <div className="w-3 h-0.5 bg-cream/60 rounded mr-1"></div>
              )}
              {change}
            </span>
            {period && <span className="text-xs text-cream/40 ml-1">{period}</span>}
          </div>
        )}
      </div>
    </div>
  )
}

