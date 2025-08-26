"use client"

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Plus, 
  ChevronDown, 
  ChevronRight,
  Banknote,
  Home,
  Car,
  Gem,
  CreditCard,
  GraduationCap,
  Building,
  AlertCircle,
  Edit,
  Trash2,
  Eye,
  EyeOff,
  PlusCircle,
  ArrowLeft
} from 'lucide-react'
import { DashboardSidebar } from '../../../components/dashboard/sidebar'
import { MetricCard } from '../../../components/dashboard/metric-card'
import { Button } from '../../../components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card'
import { Badge } from '../../../components/ui/badge'
import { useAuth } from '../../../contexts/auth-context'
import { MotionContainer } from '../../../components/ui/motion-container'
import { LoadingSpinner } from '../../../components/ui/loading-spinner'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../../../components/ui/dropdown-menu'
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts'
import { 
  Asset, 
  Liability, 
  NetWorthCalculation, 
  NetWorthTrend, 
  AssetCategory, 
  LiabilityCategory,
  AssetType,
  LiabilityType
} from '../../../lib/types'
import { AssetLiabilityBreakdown } from "../../../components/dashboard/asset-liability-breakdown"
import { NetWorthTrends } from "../../../components/dashboard/net-worth-trends"  
import { AssetLiabilityForm } from "../../../components/dashboard/asset-liability-form"
import { api } from "../../../lib/api"
import Link from "next/link"

// Category configurations for display
const ASSET_CATEGORY_CONFIG = {
  bank_accounts: {
    label: 'Bank Accounts',
    icon: Banknote,
    color: 'text-cream/60',
    types: ['checking', 'savings', 'money_market', 'cd']
  },
  investment_accounts: {
    label: 'Investment Accounts',
    icon: TrendingUp,
    color: 'text-cream/60',
    types: ['stocks', 'crypto', 'retirement_401k', 'retirement_ira', 'mutual_funds', 'bonds', 'brokerage']
  },
  real_estate: {
    label: 'Real Estate',
    icon: Home,
    color: 'text-cream/60',
    types: ['primary_residence', 'rental_property', 'commercial_property', 'land']
  },
  vehicles: {
    label: 'Vehicles',
    icon: Car,
    color: 'text-cream/60',
    types: ['car', 'truck', 'motorcycle', 'boat', 'rv']
  },
  other_valuables: {
    label: 'Other Valuables',
    icon: Gem,
    color: 'text-cream/60',
    types: ['collectibles', 'business_ownership', 'jewelry', 'art', 'other']
  }
}

const LIABILITY_CATEGORY_CONFIG = {
  credit_cards: {
    label: 'Credit Cards',
    icon: CreditCard,
    color: 'text-cream/60',
    types: ['credit_card', 'store_card', 'business_card']
  },
  mortgages: {
    label: 'Mortgages',
    icon: Home,
    color: 'text-cream/60',
    types: ['primary_mortgage', 'second_mortgage', 'heloc']
  },
  student_loans: {
    label: 'Student Loans',
    icon: GraduationCap,
    color: 'text-cream/60',
    types: ['federal_student_loan', 'private_student_loan']
  },
  auto_loans: {
    label: 'Auto Loans',
    icon: Car,
    color: 'text-cream/60',
    types: ['car_loan', 'truck_loan', 'motorcycle_loan']
  },
  personal_loans: {
    label: 'Personal Loans',
    icon: DollarSign,
    color: 'text-cream/60',
    types: ['personal_loan', 'payday_loan', 'medical_debt']
  },
  other_debts: {
    label: 'Other Debts',
    icon: Building,
    color: 'text-cream/60',
    types: ['business_loan', 'family_loan', 'other']
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

const formatPercent = (percent: number): string => {
  return `${percent >= 0 ? '+' : ''}${percent.toFixed(1)}%`
}

const getTypeLabel = (type: AssetType | LiabilityType): string => {
  return type.split('_').map(word => 
    word.charAt(0).toUpperCase() + word.slice(1)
  ).join(' ')
}

// Animation variants
const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
}

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5 } },
}

export default function NetWorthPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const [collapsed, setCollapsed] = useState(false)
  const [loading, setLoading] = useState(true)
  const [netWorth, setNetWorth] = useState<NetWorthCalculation | null>(null)
  const [assets, setAssets] = useState<Asset[]>([])
  const [liabilities, setLiabilities] = useState<Liability[]>([])
  const [showAddForm, setShowAddForm] = useState(false)
  const [formType, setFormType] = useState<'asset' | 'liability'>('asset')
  const [editingItem, setEditingItem] = useState<Asset | Liability | null>(null)

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/auth/login')
      return
    }
    
    if (user) {
      fetchNetWorthData()
    }
  }, [user, authLoading, router])

  const fetchNetWorthData = async () => {
    try {
      setLoading(true)
      const token = await user?.getIdToken()
      
      // Fetch net worth calculation
      const netWorthData = await api.get('net-worth/calculate', { token })
      
      setNetWorth(netWorthData.data)
      setAssets(netWorthData.data.assets || [])
      setLiabilities(netWorthData.data.liabilities || [])
    } catch (error) {

    } finally {
      setLoading(false)
    }
  }

  const handleAddNew = (type: 'asset' | 'liability') => {
    setFormType(type)
    setEditingItem(null)
    setShowAddForm(true)
  }

  const handleEdit = (item: Asset | Liability, type: 'asset' | 'liability') => {
    setFormType(type)
    setEditingItem(item)
    setShowAddForm(true)
  }

  const handleFormSuccess = () => {
    setShowAddForm(false)
    setEditingItem(null)
    fetchNetWorthData() // Refresh data
  }

  const handleDeleteAsset = async (assetId: string) => {
    try {
      const token = await user?.getIdToken()
      await api.delete(`net-worth/assets/${assetId}`, { token })
      fetchNetWorthData() // Refresh data
    } catch (error) {

    }
  }

  const handleDeleteLiability = async (liabilityId: string) => {
    try {
      const token = await user?.getIdToken()
      await api.delete(`net-worth/liabilities/${liabilityId}`, { token })
      fetchNetWorthData() // Refresh data
    } catch (error) {

    }
  }

  if (authLoading || loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-dark text-cream">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-dark text-cream overflow-hidden">
      <DashboardSidebar collapsed={collapsed} setCollapsed={setCollapsed} />
      
      <main className="flex-1 overflow-auto p-4 sm:p-6 md:p-8 lg:p-10">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <motion.header
            className="flex flex-col gap-4 mb-6 sm:mb-8"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center ml-12 md:ml-0">
                <div>
                  <h1 className="text-xl sm:text-2xl md:text-3xl font-medium font-outfit">Net Worth</h1>
                  <p className="text-cream/60 text-sm mt-1 font-outfit">
                    Track your assets, liabilities, and overall financial position
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <DropdownMenu>
                  <DropdownMenuTrigger className="hidden md:flex items-center justify-center h-10 px-4 rounded-full bg-cream text-dark font-medium text-sm transition-all hover:bg-cream/90">
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Add
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="bg-dark border-cream/10">
                    <DropdownMenuItem
                      className="text-cream hover:bg-cream/10 cursor-pointer"
                      onClick={() => handleAddNew('asset')}
                    >
                      <Building className="mr-2 h-4 w-4" />
                      Add Asset
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="text-cream hover:bg-cream/10 cursor-pointer"
                      onClick={() => handleAddNew('liability')}
                    >
                      <CreditCard className="mr-2 h-4 w-4" />
                      Add Liability
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </motion.header>

          {/* Metrics Cards */}
          <motion.div 
            variants={container}
            initial="hidden"
            animate="show"
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 mb-6 sm:mb-8"
          >
            <motion.div variants={item}>
              <MotionContainer delay={0.1}>
                <MetricCard
                  title="Total Assets"
                  value={formatCurrency(netWorth?.totalAssets || 0)}
                  icon={<Building className="h-5 w-5" />}
                />
              </MotionContainer>
            </motion.div>

            <motion.div variants={item}>
              <MotionContainer delay={0.2}>
                <MetricCard
                  title="Total Liabilities"
                  value={formatCurrency(netWorth?.totalLiabilities || 0)}
                  icon={<CreditCard className="h-5 w-5" />}
                />
              </MotionContainer>
            </motion.div>

            <motion.div variants={item}>
              <MotionContainer delay={0.3}>
                <MetricCard
                  title="Net Worth"
                  value={formatCurrency(netWorth?.netWorth || 0)}
                  change={netWorth?.monthlyChangePercent ? formatPercent(netWorth.monthlyChangePercent) : undefined}
                  trend={netWorth?.monthlyChange ? (netWorth.monthlyChange >= 0 ? "up" : "down") : undefined}
                  period={netWorth?.monthlyChange ? "vs last month" : undefined}
                  icon={<DollarSign className="h-5 w-5" />}
                />
              </MotionContainer>
            </motion.div>
          </motion.div>

          {/* Mobile Add Button */}
          <motion.div 
            className="mb-6 md:hidden"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
          >
            <DropdownMenu>
              <DropdownMenuTrigger className="flex items-center justify-center h-10 px-4 rounded-full bg-cream text-dark font-medium text-sm transition-all hover:bg-cream/90">
                <PlusCircle className="mr-2 h-4 w-4" />
                Add
              </DropdownMenuTrigger>
              <DropdownMenuContent className="bg-dark border-cream/10">
                <DropdownMenuItem
                  className="text-cream hover:bg-cream/10 cursor-pointer"
                  onClick={() => handleAddNew('asset')}
                >
                  <Building className="mr-2 h-4 w-4" />
                  Add Asset
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-cream hover:bg-cream/10 cursor-pointer"
                  onClick={() => handleAddNew('liability')}
                >
                  <CreditCard className="mr-2 h-4 w-4" />
                  Add Liability
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </motion.div>

          {/* Main Content */}
          <motion.div 
            variants={container}
            initial="hidden"
            animate="show"
            className="space-y-8"
          >
            {/* Asset & Liability Breakdown */}
            <motion.div 
              variants={item}
              className="pt-6 first:pt-0"
            >
              <div className="border-t border-cream/10 pt-6 first:border-t-0 first:pt-0">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-lg font-medium font-outfit">Assets & Liabilities</h2>
                  <span className="text-xs bg-cream/10 text-cream/80 px-2 py-1 rounded-full">
                    {assets.length + liabilities.length} items
                  </span>
                </div>
                <AssetLiabilityBreakdown
                  assets={assets}
                  liabilities={liabilities}
                  onAddAsset={() => handleAddNew('asset')}
                  onAddLiability={() => handleAddNew('liability')}
                  onEditAsset={(asset) => handleEdit(asset, 'asset')}
                  onEditLiability={(liability) => handleEdit(liability, 'liability')}
                  onDeleteAsset={handleDeleteAsset}
                  onDeleteLiability={handleDeleteLiability}
                />
              </div>
            </motion.div>

            {/* Net Worth Trends */}
            <motion.div 
              variants={item}
              className="pt-6"
            >
              <div className="border-t border-cream/10 pt-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-lg font-medium font-outfit">Net Worth Trends</h2>
                  <span className="text-xs bg-cream/10 text-cream/80 px-2 py-1 rounded-full">
                    Historical View
                  </span>
                </div>
                <NetWorthTrends
                  currentNetWorth={netWorth?.netWorth || 0}
                  monthlyChange={netWorth?.monthlyChange}
                  monthlyChangePercent={netWorth?.monthlyChangePercent}
                />
              </div>
            </motion.div>

            {/* Net Worth Insights */}
            <motion.div 
              variants={item}
              className="pt-6"
            >
              <div className="border-t border-cream/10 pt-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-lg font-medium font-outfit">Financial Insights</h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
                  <motion.div
                    className="bg-cream/5 rounded-lg p-4 hover:bg-cream/10 transition-colors duration-300"
                    whileHover={{ y: -2 }}
                    transition={{ type: "spring", stiffness: 300 }}
                  >
                    <h3 className="text-sm font-medium mb-2 font-outfit">Assets vs Liabilities</h3>
                    <p className="text-2xl font-medium">
                      {netWorth?.totalAssets && netWorth?.totalLiabilities 
                        ? (netWorth.totalAssets / (netWorth.totalLiabilities || 1)).toFixed(1) + ':1'
                        : 'N/A'
                      }
                    </p>
                    <p className="text-cream/60 text-sm">Asset to debt ratio</p>
                  </motion.div>
                  
                  <motion.div
                    className="bg-cream/5 rounded-lg p-4 hover:bg-cream/10 transition-colors duration-300"
                    whileHover={{ y: -2 }}
                    transition={{ type: "spring", stiffness: 300 }}
                  >
                    <h3 className="text-sm font-medium mb-2 font-outfit">Largest Asset</h3>
                    <p className="text-2xl font-medium">
                      {assets.length > 0 
                        ? assets.reduce((prev, current) => (current.currentValue > prev.currentValue ? current : prev)).name
                        : 'N/A'
                      }
                    </p>
                    <p className="text-cream/60 text-sm">
                      {assets.length > 0 
                        ? formatCurrency(assets.reduce((prev, current) => (current.currentValue > prev.currentValue ? current : prev)).currentValue)
                        : '$0.00'
                      }
                    </p>
                  </motion.div>
                  
                  <motion.div
                    className="bg-cream/5 rounded-lg p-4 hover:bg-cream/10 transition-colors duration-300"
                    whileHover={{ y: -2 }}
                    transition={{ type: "spring", stiffness: 300 }}
                  >
                    <h3 className="text-sm font-medium mb-2 font-outfit">Largest Liability</h3>
                    <p className="text-2xl font-medium">
                      {liabilities.length > 0 
                        ? liabilities.reduce((prev, current) => (current.currentBalance > prev.currentBalance ? current : prev)).name
                        : 'N/A'
                      }
                    </p>
                    <p className="text-cream/60 text-sm">
                      {liabilities.length > 0 
                        ? formatCurrency(liabilities.reduce((prev, current) => (current.currentBalance > prev.currentBalance ? current : prev)).currentBalance)
                        : '$0.00'
                      }
                    </p>
                  </motion.div>
                </div>
              </div>
            </motion.div>
          </motion.div>

          {/* Asset/Liability Form Modal */}
          {showAddForm && (
            <AssetLiabilityForm
              type={formType}
              editItem={editingItem}
              onSuccess={handleFormSuccess}
              onCancel={() => {
                setShowAddForm(false)
                setEditingItem(null)
              }}
            />
          )}
        </div>
      </main>
    </div>
  )
} 