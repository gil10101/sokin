"use client"

import { useState, useEffect } from "react"
import { useAuth } from "@/contexts/auth-context"
import { StockAPI, UserPortfolioStock } from "@/lib/stock-api"

export interface PortfolioState {
  isEmpty: boolean
  isLoading: boolean
  hasError: boolean
  portfolioCount: number
  totalValue: number
}

/**
 * Hook to manage portfolio state and determine layout flexibility
 */
export function usePortfolioState(): PortfolioState {
  const { user } = useAuth()
  const [portfolioState, setPortfolioState] = useState<PortfolioState>({
    isEmpty: true,
    isLoading: true,
    hasError: false,
    portfolioCount: 0,
    totalValue: 0,
  })

  useEffect(() => {
    const checkPortfolioState = async () => {
      if (!user) {
        setPortfolioState({
          isEmpty: true,
          isLoading: false,
          hasError: false,
          portfolioCount: 0,
          totalValue: 0,
        })
        return
      }

      try {
        setPortfolioState(prev => ({ ...prev, isLoading: true, hasError: false }))
        
        const portfolio = await StockAPI.getUserPortfolio(user.uid)
        const totalValue = portfolio.reduce((sum, stock) => sum + stock.totalValue, 0)
        
        setPortfolioState({
          isEmpty: portfolio.length === 0,
          isLoading: false,
          hasError: false,
          portfolioCount: portfolio.length,
          totalValue,
        })
      } catch (error) {
        console.error('Error checking portfolio state:', error)
        setPortfolioState(prev => ({
          ...prev,
          isLoading: false,
          hasError: true,
        }))
      }
    }

    checkPortfolioState()
  }, [user])

  return portfolioState
}
