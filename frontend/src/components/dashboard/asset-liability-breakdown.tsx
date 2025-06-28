"use client"

import React, { useState, useEffect } from 'react'
import { 
  ChevronDown, 
  ChevronRight, 
  Edit, 
  Trash2, 
  PlusCircle,
  Banknote,
  TrendingUp,
  Home,
  Car,
  Gem,
  CreditCard,
  GraduationCap,
  Building,
  DollarSign
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card'
import { Button } from '../ui/button'
import { Badge } from '../ui/badge'
import { useAuth } from '../../contexts/auth-context'
import { 
  Asset, 
  Liability, 
  AssetCategory, 
  LiabilityCategory,
  AssetType,
  LiabilityType
} from '../../lib/types'

interface AssetLiabilityBreakdownProps {
  assets: Asset[]
  liabilities: Liability[]
  onAddAsset: () => void
  onAddLiability: () => void
  onEditAsset: (asset: Asset) => void
  onEditLiability: (liability: Liability) => void
  onDeleteAsset: (assetId: string) => void
  onDeleteLiability: (liabilityId: string) => void
}

// Category configurations
const ASSET_CATEGORY_CONFIG = {
  bank_accounts: {
    label: 'Bank Accounts',
    icon: Banknote,
    color: 'text-cream/60'
  },
  investment_accounts: {
    label: 'Investment Accounts',
    icon: TrendingUp,
    color: 'text-cream/60'
  },
  real_estate: {
    label: 'Real Estate',
    icon: Home,
    color: 'text-cream/60'
  },
  vehicles: {
    label: 'Vehicles',
    icon: Car,
    color: 'text-cream/60'
  },
  other_valuables: {
    label: 'Other Valuables',
    icon: Gem,
    color: 'text-cream/60'
  }
}

const LIABILITY_CATEGORY_CONFIG = {
  credit_cards: {
    label: 'Credit Cards',
    icon: CreditCard,
    color: 'text-cream/60'
  },
  mortgages: {
    label: 'Mortgages',
    icon: Home,
    color: 'text-cream/60'
  },
  student_loans: {
    label: 'Student Loans',
    icon: GraduationCap,
    color: 'text-cream/60'
  },
  auto_loans: {
    label: 'Auto Loans',
    icon: Car,
    color: 'text-cream/60'
  },
  personal_loans: {
    label: 'Personal Loans',
    icon: DollarSign,
    color: 'text-cream/60'
  },
  other_debts: {
    label: 'Other Debts',
    icon: Building,
    color: 'text-cream/60'
  }
}

// Helper functions
const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount)
}

const getTypeLabel = (type: AssetType | LiabilityType): string => {
  return type.split('_').map(word => 
    word.charAt(0).toUpperCase() + word.slice(1)
  ).join(' ')
}

export function AssetLiabilityBreakdown({ 
  assets, 
  liabilities, 
  onAddAsset, 
  onAddLiability, 
  onEditAsset, 
  onEditLiability,
  onDeleteAsset,
  onDeleteLiability
}: AssetLiabilityBreakdownProps) {
  const [expandedAssetCategories, setExpandedAssetCategories] = useState<Set<AssetCategory>>(new Set())
  const [expandedLiabilityCategories, setExpandedLiabilityCategories] = useState<Set<LiabilityCategory>>(new Set())
  
  // Group assets by category
  const groupedAssets = assets.reduce((acc, asset) => {
    if (!acc[asset.category]) {
      acc[asset.category] = []
    }
    acc[asset.category].push(asset)
    return acc
  }, {} as Record<AssetCategory, Asset[]>)

  // Group liabilities by category
  const groupedLiabilities = liabilities.reduce((acc, liability) => {
    if (!acc[liability.category]) {
      acc[liability.category] = []
    }
    acc[liability.category].push(liability)
    return acc
  }, {} as Record<LiabilityCategory, Liability[]>)

  const toggleAssetCategory = (category: AssetCategory) => {
    const newExpanded = new Set(expandedAssetCategories)
    if (newExpanded.has(category)) {
      newExpanded.delete(category)
    } else {
      newExpanded.add(category)
    }
    setExpandedAssetCategories(newExpanded)
  }

  const toggleLiabilityCategory = (category: LiabilityCategory) => {
    const newExpanded = new Set(expandedLiabilityCategories)
    if (newExpanded.has(category)) {
      newExpanded.delete(category)
    } else {
      newExpanded.add(category)
    }
    setExpandedLiabilityCategories(newExpanded)
  }

  const handleDeleteAsset = async (assetId: string) => {
    if (window.confirm('Are you sure you want to delete this asset?')) {
      try {
        onDeleteAsset(assetId)
      } catch (error) {
        console.error('Error deleting asset:', error)
      }
    }
  }

  const handleDeleteLiability = async (liabilityId: string) => {
    if (window.confirm('Are you sure you want to delete this liability?')) {
      try {
        onDeleteLiability(liabilityId)
      } catch (error) {
        console.error('Error deleting liability:', error)
      }
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Assets Section */}
      <Card className="bg-cream/5 border-cream/10">
        <CardHeader>
          <CardTitle className="text-cream">Assets</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {Object.entries(ASSET_CATEGORY_CONFIG).map(([category, config]) => {
            const categoryAssets = groupedAssets[category as AssetCategory] || []
            const isExpanded = expandedAssetCategories.has(category as AssetCategory)
            const totalValue = categoryAssets.reduce((sum, asset) => sum + asset.currentValue, 0)
            const Icon = config.icon

            return (
              <div key={category} className="border border-cream/10 rounded-lg">
                <button
                  onClick={() => toggleAssetCategory(category as AssetCategory)}
                  className="w-full flex items-center justify-between p-4 hover:bg-cream/5 transition-colors"
                >
                  <div className="flex items-center space-x-3">
                    <Icon className={`h-5 w-5 ${config.color}`} />
                    <div className="text-left">
                      <h3 className="font-medium text-cream">{config.label}</h3>
                      <p className="text-sm text-cream/60">{categoryAssets.length} items</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3">
                    <span className="font-bold text-cream">{formatCurrency(totalValue)}</span>
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4 text-cream/60" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-cream/60" />
                    )}
                  </div>
                </button>

                {isExpanded && categoryAssets.length > 0 && (
                  <div className="border-t border-cream/10 bg-cream/2">
                    {categoryAssets.map((asset) => (
                      <div key={asset.id} className="flex items-center justify-between p-4 border-b border-cream/5 last:border-b-0">
                        <div className="flex-1">
                          <h4 className="font-medium text-cream">{asset.name}</h4>
                          <p className="text-sm text-cream/60">{getTypeLabel(asset.type)}</p>
                          {asset.description && (
                            <p className="text-xs text-cream/50 mt-1">{asset.description}</p>
                          )}
                        </div>
                        <div className="flex items-center space-x-3">
                          <span className="font-bold text-cream">{formatCurrency(asset.currentValue)}</span>
                          <div className="flex space-x-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => onEditAsset(asset)}
                              className="h-8 w-8 p-0 hover:bg-cream/10"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleDeleteAsset(asset.id!)}
                              className="h-8 w-8 p-0 hover:bg-red-500/10 hover:text-red-400"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {isExpanded && categoryAssets.length === 0 && (
                  <div className="border-t border-cream/10 p-4 text-center text-cream/60">
                    No {config.label.toLowerCase()} added yet
                  </div>
                )}
              </div>
            )
          })}
        </CardContent>
      </Card>

      {/* Liabilities Section */}
      <Card className="bg-cream/5 border-cream/10">
        <CardHeader>
          <CardTitle className="text-cream">Liabilities</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {Object.entries(LIABILITY_CATEGORY_CONFIG).map(([category, config]) => {
            const categoryLiabilities = groupedLiabilities[category as LiabilityCategory] || []
            const isExpanded = expandedLiabilityCategories.has(category as LiabilityCategory)
            const totalBalance = categoryLiabilities.reduce((sum, liability) => sum + liability.currentBalance, 0)
            const Icon = config.icon

            return (
              <div key={category} className="border border-cream/10 rounded-lg">
                <button
                  onClick={() => toggleLiabilityCategory(category as LiabilityCategory)}
                  className="w-full flex items-center justify-between p-4 hover:bg-cream/5 transition-colors"
                >
                  <div className="flex items-center space-x-3">
                    <Icon className={`h-5 w-5 ${config.color}`} />
                    <div className="text-left">
                      <h3 className="font-medium text-cream">{config.label}</h3>
                      <p className="text-sm text-cream/60">{categoryLiabilities.length} items</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3">
                    <span className="font-bold text-red-400">{formatCurrency(totalBalance)}</span>
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4 text-cream/60" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-cream/60" />
                    )}
                  </div>
                </button>

                {isExpanded && categoryLiabilities.length > 0 && (
                  <div className="border-t border-cream/10 bg-cream/2">
                    {categoryLiabilities.map((liability) => (
                      <div key={liability.id} className="flex items-center justify-between p-4 border-b border-cream/5 last:border-b-0">
                                                 <div className="flex-1">
                           <h4 className="font-medium text-cream">{liability.name}</h4>
                           <p className="text-sm text-cream/60">{getTypeLabel(liability.type)}</p>
                           {liability.metadata?.notes && (
                             <p className="text-xs text-cream/50 mt-1">{liability.metadata.notes}</p>
                           )}
                           {liability.interestRate && (
                             <p className="text-xs text-cream/50">Interest: {liability.interestRate}%</p>
                           )}
                         </div>
                        <div className="flex items-center space-x-3">
                          <span className="font-bold text-red-400">{formatCurrency(liability.currentBalance)}</span>
                          <div className="flex space-x-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => onEditLiability(liability)}
                              className="h-8 w-8 p-0 hover:bg-cream/10"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleDeleteLiability(liability.id!)}
                              className="h-8 w-8 p-0 hover:bg-red-500/10 hover:text-red-400"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {isExpanded && categoryLiabilities.length === 0 && (
                  <div className="border-t border-cream/10 p-4 text-center text-cream/60">
                    No {config.label.toLowerCase()} added yet
                  </div>
                )}
              </div>
            )
          })}
        </CardContent>
      </Card>
    </div>
  )
} 