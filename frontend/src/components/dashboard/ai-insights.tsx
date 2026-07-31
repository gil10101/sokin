"use client"

import { Sparkles, AlertCircle, RefreshCw } from "lucide-react"
import { useQuery } from "@tanstack/react-query"
import { Card, CardContent } from "../ui/card"
import { Button } from "../ui/button"
import { useAuth } from "@/contexts/auth-context"
import { api } from "@/lib/api"
import { useCurrency } from "@/hooks/use-currency"

interface SpendingInsight {
  headline: string
  observations: string[]
  suggestion: string
}

interface InsightFacts {
  totalThisMonth: number
  totalLastMonth: number
  avgMonthly6: number
  topCategories: Array<{ category: string; total: number }>
}

interface InsightPayload {
  insight: SpendingInsight
  facts: InsightFacts
}

/**
 * A written summary of the month's spending.
 *
 * The figures the summary was computed from are rendered underneath it. That is
 * the point of the component as much as the prose: an unsourced claim about
 * someone's money is not worth showing, and displaying the inputs lets a reader
 * check the sentence against the numbers rather than taking it on faith.
 */
export function AiInsights() {
  const { user } = useAuth()
  const { format: formatCurrency } = useCurrency()

  // Gate on availability so an unconfigured deployment renders nothing at all,
  // rather than a button that can only ever fail.
  const statusQuery = useQuery({
    queryKey: ["ai-status", user?.uid],
    queryFn: async () => {
      const token = await user?.getIdToken()
      const res = (await api.get("ai/status", { token })) as { data?: { available?: boolean } }
      return Boolean(res.data?.available)
    },
    enabled: !!user,
    staleTime: 60 * 60 * 1000,
  })

  const insightQuery = useQuery({
    queryKey: ["ai-insights", user?.uid],
    queryFn: async () => {
      const token = await user?.getIdToken()
      const res = (await api.get("ai/insights", { token })) as { data?: InsightPayload }
      return res.data ?? null
    },
    enabled: !!user && statusQuery.data === true,
    // Each run costs a model call, so this is cached far longer than ordinary
    // dashboard data and never refetches on focus.
    staleTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: false,
  })

  if (statusQuery.data !== true) return null

  const payload = insightQuery.data

  return (
    <Card className="bg-cream/5 border-cream/10">
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-cream/60" />
            <h3 className="text-sm text-cream/60 font-outfit">This month, in words</h3>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-cream/50 hover:text-cream"
            onClick={() => insightQuery.refetch()}
            disabled={insightQuery.isFetching}
            aria-label="Regenerate summary"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${insightQuery.isFetching ? "animate-spin" : ""}`} />
          </Button>
        </div>

        {insightQuery.isLoading ? (
          <div className="space-y-2" aria-label="Generating summary">
            <div className="h-5 w-3/4 bg-cream/10 rounded animate-pulse" />
            <div className="h-4 w-full bg-cream/5 rounded animate-pulse" />
            <div className="h-4 w-5/6 bg-cream/5 rounded animate-pulse" />
          </div>
        ) : insightQuery.isError ? (
          <div className="flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-red-400/80 mt-0.5 shrink-0" />
            <p className="text-sm text-cream/60">
              Couldn&apos;t generate a summary right now. Your data is unaffected.
            </p>
          </div>
        ) : payload ? (
          <>
            <p className="text-cream font-outfit leading-relaxed">{payload.insight.headline}</p>

            <ul className="mt-3 space-y-1.5">
              {payload.insight.observations.map((observation, index) => (
                <li key={index} className="text-sm text-cream/70 flex gap-2">
                  <span className="text-cream/30 select-none">—</span>
                  <span>{observation}</span>
                </li>
              ))}
            </ul>

            {payload.insight.suggestion && (
              <p className="mt-4 text-sm text-cream/80 border-l-2 border-cream/20 pl-3">
                {payload.insight.suggestion}
              </p>
            )}

            {/*
              The inputs, shown plainly. Written by a model, computed by the
              backend - a reader can check one against the other.
            */}
            <div className="mt-5 pt-4 border-t border-cream/10">
              <p className="text-[11px] font-roboto-mono text-cream/40 mb-2">
                Summarized from
              </p>
              <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-cream/50 font-roboto-mono">
                <span>this month {formatCurrency(payload.facts.totalThisMonth, { decimals: 0 })}</span>
                <span>last month {formatCurrency(payload.facts.totalLastMonth, { decimals: 0 })}</span>
                <span>6-mo avg {formatCurrency(payload.facts.avgMonthly6, { decimals: 0 })}</span>
                {payload.facts.topCategories.slice(0, 3).map((c) => (
                  <span key={c.category}>
                    {c.category} {formatCurrency(c.total, { decimals: 0 })}
                  </span>
                ))}
              </div>
            </div>
          </>
        ) : (
          <p className="text-sm text-cream/60">
            Add a few expenses this month and a summary will appear here.
          </p>
        )}
      </CardContent>
    </Card>
  )
}
