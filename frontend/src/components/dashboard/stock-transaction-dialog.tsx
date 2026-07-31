"use client"

import React, { useState, useEffect, useCallback } from "react"
import { Plus, Minus, DollarSign, Activity } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { toast } from "@/hooks/use-toast"
import { logger } from "@/lib/logger"
import { User } from "@/lib/types"
import { StockAPI, StockData, CurrencyTransaction, formatPrice, formatPercent } from "@/lib/stock-api"

export interface TransactionDialogProps {
  stock: StockData | null;
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (transaction: CurrencyTransaction) => void;
  user?: User | null;
  mode?: 'trade' | 'add';
}

export const TransactionDialog: React.FC<TransactionDialogProps> = ({ stock, isOpen, onClose, onSubmit, user, mode = 'trade' }) => {
  const [amount, setAmount] = useState<number>(0)
  /**
   * The Buy/Sell toggle only exists in 'trade' mode, so in 'add' mode the user
   * has no way to see or change this. Deriving the effective type from `mode`
   * rather than reading the stored choice makes it impossible for an "Add"
   * to submit a sell - which is what happened when this was plain state that
   * outlived the dialog (Trade -> Sell -> close -> Add submitted a sell).
   */
  const [tradeType, setTradeType] = useState<'buy' | 'sell'>('buy')
  const transactionType: 'buy' | 'sell' = mode === 'add' ? 'buy' : tradeType
  const [inputMode, setInputMode] = useState<'currency' | 'shares'>('currency')
  const [maxSellInfo, setMaxSellInfo] = useState<{ shares: number; value: number; price: number } | null>(null)
  const [loading, setLoading] = useState(false)

  // Quick amount buttons - different for currency vs shares
  const quickAmounts = inputMode === 'currency' ? [1, 10, 100, 500, 1000] : [1, 5, 10, 50, 100]

  const loadMaxSellInfo = useCallback(async () => {
    if (!stock || !user) return
    
    try {
      setLoading(true)
      const maxInfo = await StockAPI.getMaxSellAmount(user.uid, stock.symbol)
      setMaxSellInfo(maxInfo)
    } catch (error) {
      logger.error("Error loading max sell amount", {
        userId: user.uid,
        symbol: stock.symbol,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    } finally {
      setLoading(false)
    }
  }, [stock, user])

  useEffect(() => {
    if (stock && user && transactionType === 'sell') {
      loadMaxSellInfo()
    } else {
      setMaxSellInfo(null)
    }
  }, [stock, user, transactionType, loadMaxSellInfo])

  const handleSubmit = () => {
    if (!stock || amount <= 0) return
    
    // Calculate the final USD amount based on input mode
    const finalAmount = inputMode === 'currency' ? amount : amount * stock.price
    
    // Validate sell amount
    if (transactionType === 'sell' && maxSellInfo) {
      if (finalAmount > maxSellInfo.value) {
        toast({
          title: "Invalid Amount",
          description: `You can only sell up to ${formatPrice(maxSellInfo.value)} worth of ${stock.symbol} (${maxSellInfo.shares} shares)`,
          variant: "destructive",
        })
        return
      }
    }
    
    if (!user) {
      toast({
        title: "Authentication Required",
        description: "Please sign in to complete transactions",
      })
      return
    }
    
    onSubmit({
      userId: user.uid,
      symbol: stock.symbol,
      amount: finalAmount,
      price: stock.price,
      type: transactionType
    })
    
    setAmount(0)
    onClose()
  }

  const calculateShares = () => {
    if (!stock || amount <= 0) return 0
    if (inputMode === 'shares') return amount
    return Math.floor(amount / stock.price * 100) / 100
  }

  const calculateCurrencyAmount = () => {
    if (!stock || amount <= 0) return 0
    if (inputMode === 'currency') return amount
    return amount * stock.price
  }

  const setQuickAmount = (quickAmount: number) => {
    setAmount(quickAmount)
  }

  const setMaxAmount = () => {
    if (maxSellInfo) {
      if (inputMode === 'currency') {
        setAmount(maxSellInfo.value)
      } else {
        setAmount(maxSellInfo.shares)
      }
    }
  }

  if (!stock) return null

  const shares = calculateShares()

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-dark border-cream/10 text-cream max-w-sm mx-4 sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-cream flex items-center space-x-2">
            <span>
              {mode === 'add' ? 'Add' : (transactionType === 'buy' ? 'Buy' : 'Sell')} {stock.symbol}
              {mode === 'add' ? ' to Portfolio' : ''}
            </span>
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex items-center justify-between p-3 bg-cream/5 rounded-lg">
            <div>
              <p className="font-medium text-cream">{stock.symbol}</p>
              <p className="text-sm text-cream/70 line-clamp-1">{stock.name}</p>
            </div>
            <div className="text-right">
              <p className="font-semibold text-cream">{formatPrice(stock.price)}</p>
              <p className={`text-sm ${
                stock.changePercent > 0 ? 'text-green-500' : 
                stock.changePercent < 0 ? 'text-red-500' : 
                'text-cream/60'
              }`}>
                {formatPercent(stock.changePercent)}
              </p>
            </div>
          </div>

          {mode !== 'add' && (
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant={transactionType === 'buy' ? 'default' : 'outline'}
                onClick={() => setTradeType('buy')}
                className="flex items-center justify-center"
              >
                <Plus className="h-4 w-4 mr-1" />
                Buy
              </Button>
              <Button
                variant={transactionType === 'sell' ? 'default' : 'outline'}
                onClick={() => setTradeType('sell')}
                className="flex items-center justify-center"
              >
                <Minus className="h-4 w-4 mr-1" />
                Sell
              </Button>
            </div>
          )}

          {/* Input Mode Toggle */}
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant={inputMode === 'currency' ? 'default' : 'outline'}
              onClick={() => {
                setInputMode('currency')
                setAmount(0)
              }}
              className="flex items-center justify-center text-sm"
            >
              <DollarSign className="h-4 w-4 mr-1" />
              USD Amount
            </Button>
            <Button
              variant={inputMode === 'shares' ? 'default' : 'outline'}
              onClick={() => {
                setInputMode('shares')
                setAmount(0)
              }}
              className="flex items-center justify-center text-sm"
            >
              <Activity className="h-4 w-4 mr-1" />
              Shares
            </Button>
          </div>

          {/* Show max sell info for sell transactions */}
          {transactionType === 'sell' && maxSellInfo && (
            <div className="p-3 bg-blue-900/20 border border-blue-500/20 rounded-lg">
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs text-cream/70">Available to sell:</span>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={setMaxAmount}
                  className="text-xs h-6 px-2"
                >
                  Use Max
                </Button>
              </div>
              <p className="text-sm text-cream">
                {maxSellInfo.shares} shares • {formatPrice(maxSellInfo.value)}
              </p>
            </div>
          )}

          {/* Amount Input */}
          <div>
            <Label htmlFor="amount" className="text-cream/80">
              {inputMode === 'currency' ? 'Amount (USD)' : 'Number of Shares'}
            </Label>
            <Input
              id="amount"
              type="number"
              min="0"
              step={inputMode === 'currency' ? '0.01' : '1'}
              value={amount || ''}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                const value = e.target.value
                if (value === '' || value === '0') {
                  setAmount(0)
                } else {
                  const parsedValue = parseFloat(value)
                  setAmount(isNaN(parsedValue) ? 0 : Math.max(0, parsedValue))
                }
              }}
              className="bg-cream/5 border-cream/10 text-cream mt-1"
              placeholder={inputMode === 'currency' ? 'Enter amount in USD' : 'Enter number of shares'}
            />
            {amount > 0 && (
              <p className="text-xs text-cream/60 mt-1">
                {inputMode === 'currency' 
                  ? `≈ ${calculateShares()} shares`
                  : `≈ ${formatPrice(calculateCurrencyAmount())}`
                }
              </p>
            )}
          </div>

          {/* Quick Amount Buttons */}
          <div>
            <Label className="text-cream/80 text-xs">
              Quick {inputMode === 'currency' ? 'amounts' : 'quantities'}:
            </Label>
            <div className="flex flex-wrap gap-2 mt-2">
              {quickAmounts.map((quickAmount) => (
                <Button
                  key={quickAmount}
                  variant="outline"
                  size="sm"
                  onClick={() => setQuickAmount(quickAmount)}
                  className="text-xs h-8 px-3"
                >
                  {inputMode === 'currency' ? `$${quickAmount}` : `${quickAmount}`}
                </Button>
              ))}
            </div>
          </div>

          {/* Summary */}
          <div className="p-3 bg-cream/5 rounded-lg space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-cream/70">Transaction Amount:</span>
              <span className="font-semibold text-cream">{formatPrice(calculateCurrencyAmount())}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-cream/70">{inputMode === 'currency' ? 'Estimated Shares:' : 'Shares:'}</span>
              <span className="font-semibold text-cream">{calculateShares()}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-cream/70">Price per Share:</span>
              <span className="font-semibold text-cream">{formatPrice(stock.price)}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={amount <= 0 || loading}>
              {loading ? <LoadingSpinner size="sm" /> : `${transactionType === 'buy' ? 'Buy' : 'Sell'} ${formatPrice(calculateCurrencyAmount())}`}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
