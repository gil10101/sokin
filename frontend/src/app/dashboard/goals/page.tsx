"use client"

import React from "react"
import { useState, useEffect, useCallback, useRef } from "react"
import { useAuth } from "@/contexts/auth-context"
import { format, differenceInDays, isAfter, isBefore, addMonths, addYears, startOfDay } from "date-fns"
import { AddButton } from "@/components/ui/add-button"
import { MetricCard } from "@/components/dashboard/metric-card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { 
  Plus, 
  Target, 
  Calendar as CalendarIcon, 
  TrendingUp, 
  Trophy, 
  DollarSign,
  Shield,
  MapPin,
  Home,
  Car,
  GraduationCap,
  User,
  Bookmark,
  Edit,
  Trash2,
  CheckCircle,
  Clock,
  AlertCircle,
  PieChart,
  TrendingDown,
  MoreHorizontal,
  ChevronRight
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { MotionContainer } from "@/components/ui/motion-container"
import { goalsAPI } from "@/lib/api"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { MotionDiv, MotionMain, MotionSection, AnimatePresence } from "@/components/ui/dynamic-motion"
import { cn } from "@/lib/utils"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { useCurrency } from "@/hooks/use-currency"
import { EmptyState } from "@/components/dashboard/empty-state"

interface SavingsGoal {
  id: string
  userId: string
  name: string
  description?: string
  targetAmount: number
  currentAmount: number
  targetDate: string
  category: string
  priority: 'low' | 'medium' | 'high'
  isCompleted: boolean
  completedAt?: string
  createdAt: string
  updatedAt?: string
  milestones?: GoalMilestone[]
  contributions?: GoalContribution[]
}

interface GoalMilestone {
  percentage: number
  amount: number
  achievedAt?: string
  celebrated?: boolean
}

interface GoalContribution {
  id: string
  amount: number
  date: string
  method: 'manual' | 'automatic' | 'roundup'
  source?: string
  note?: string
}

interface GoalFormData {
  name: string
  description: string
  targetAmount: string
  targetDate: Date
  category: string
  priority: 'low' | 'medium' | 'high'
}

const categories = [
  { value: 'emergency', label: 'Emergency Fund', icon: Shield, color: 'bg-red-500/20 text-red-400' },
  { value: 'vacation', label: 'Vacation', icon: MapPin, color: 'bg-blue-500/20 text-blue-400' },
  { value: 'home', label: 'Home/Property', icon: Home, color: 'bg-green-500/20 text-green-400' },
  { value: 'car', label: 'Vehicle', icon: Car, color: 'bg-purple-500/20 text-purple-400' },
  { value: 'education', label: 'Education', icon: GraduationCap, color: 'bg-yellow-500/20 text-yellow-400' },
  { value: 'retirement', label: 'Retirement', icon: User, color: 'bg-indigo-500/20 text-indigo-400' },
  { value: 'other', label: 'Other', icon: Bookmark, color: 'bg-cream/10 text-cream/80' }
]

const priorityConfig = {
  low: { label: 'Low', color: 'bg-cream/10 text-cream/60' },
  medium: { label: 'Medium', color: 'bg-yellow-500/20 text-yellow-400' },
  high: { label: 'High', color: 'bg-red-500/20 text-red-400' }
}

const defaultPriorityConfig = { label: 'Unknown', color: 'bg-cream/10 text-cream/80' }

interface GoalsPageProps {
  params?: Promise<Record<string, string>>;
  searchParams?: Promise<Record<string, string>>;
}

export default function GoalsPage(props: GoalsPageProps) {
  const { format: formatCurrency } = useCurrency()
  const { user } = useAuth()
  const userRef = useRef(user)
  useEffect(() => { userRef.current = user }, [user])
  const { toast } = useToast()

  const [goals, setGoals] = useState<SavingsGoal[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState("active")
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [editingGoal, setEditingGoal] = useState<SavingsGoal | null>(null)
  const [goalToDelete, setGoalToDelete] = useState<string | null>(null)
  const [showContributionDialog, setShowContributionDialog] = useState(false)
  const [showContributionsViewDialog, setShowContributionsViewDialog] = useState(false)
  const [selectedGoal, setSelectedGoal] = useState<SavingsGoal | null>(null)
  const [viewContributionsGoal, setViewContributionsGoal] = useState<SavingsGoal | null>(null)
  const [contributionAmount, setContributionAmount] = useState('')
  const [contributionNote, setContributionNote] = useState('')
  const [sortBy, setSortBy] = useState('priority')
  const [filterBy, setFilterBy] = useState('all')

  // Form state
  const [formData, setFormData] = useState<GoalFormData>({
    name: '',
    description: '',
    targetAmount: '',
    targetDate: addMonths(new Date(), 12),
    category: 'emergency',
    priority: 'medium'
  })

  const fetchGoals = useCallback(async (): Promise<SavingsGoal[]> => {
    if (!userRef.current) return []

    setLoading(true)
    try {
      const goalsData = await goalsAPI.getGoals()

      // Normalize: drop any records missing an id so downstream code can rely on id: string
      const normalizedGoals = goalsData.filter((g): g is SavingsGoal => !!g.id)

      setGoals(normalizedGoals)
      return normalizedGoals
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "There was an error loading your savings goals"
      toast({
        title: "Error loading goals",
        description: errorMessage,
        variant: "destructive",
      })
      return []
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (user) {
      fetchGoals()
    }
  }, [user])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleSelectChange = (name: string, value: string) => {
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleDateChange = (date: Date | undefined) => {
    if (date) {
      setFormData(prev => ({ ...prev, targetDate: date }))
    }
  }

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      targetAmount: '',
      targetDate: addMonths(new Date(), 12),
      category: 'emergency',
      priority: 'medium'
    })
  }

  const openEditDialog = (goal: SavingsGoal) => {
    setEditingGoal(goal)
    setFormData({
      name: goal.name,
      description: goal.description || '',
      targetAmount: goal.targetAmount.toString(),
      targetDate: new Date(goal.targetDate),
      category: goal.category,
      priority: goal.priority
    })
    setShowCreateDialog(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!user || !formData.name || !formData.targetAmount) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields",
        variant: "destructive"
      })
      return
    }

    try {
      const goalPayload = {
        name: formData.name,
        description: formData.description,
        targetAmount: parseFloat(formData.targetAmount),
        targetDate: formData.targetDate.toISOString(),
        category: formData.category,
        priority: formData.priority
      }

      if (editingGoal) {
        await goalsAPI.updateGoal(editingGoal.id, goalPayload)
        toast({
          title: "Goal Updated",
          description: `Your goal "${goalPayload.name}" has been updated successfully.`
        })
      } else {
        await goalsAPI.createGoal(goalPayload)
        toast({
          title: "Goal Created",
          description: `Your goal "${goalPayload.name}" has been created successfully.`
        })
      }

      await fetchGoals()
      setShowCreateDialog(false)
      setEditingGoal(null)
      resetForm()
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Failed to save goal"
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive"
      })
    }
  }

  const handleDeleteGoal = async () => {
    if (!goalToDelete) return

    try {
      await goalsAPI.deleteGoal(goalToDelete)
      setGoals(goals.filter(g => g.id !== goalToDelete))
      toast({
        title: "Goal Deleted",
        description: "Your goal has been deleted successfully."
      })
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Failed to delete goal"
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive"
      })
    } finally {
      setGoalToDelete(null)
    }
  }

  const handleAddContribution = async () => {
    if (!selectedGoal || !contributionAmount) return

    const amount = parseFloat(contributionAmount)
    if (!Number.isFinite(amount) || amount <= 0) {
      toast({
        title: "Invalid Amount",
        description: "Please enter a valid contribution amount",
        variant: "destructive"
      })
      return
    }

    try {
      const goalId = selectedGoal.id
      const goalName = selectedGoal.name
      const previousAmount = selectedGoal.currentAmount

      await goalsAPI.addContribution(goalId, {
        amount,
        method: "manual",
        source: "Manual Entry",
        note: contributionNote || undefined
      })

      const freshGoals = await fetchGoals()
      const updatedGoal = freshGoals.find(g => g.id === goalId)

      setShowContributionDialog(false)
      setSelectedGoal(null)
      setContributionAmount('')
      setContributionNote('')

      toast({
        title: "Contribution Added",
        description: `${formatCurrency(amount, { decimals: 0 })} has been added to your goal.`
      })

      // Check for milestones against the freshly fetched goal data
      if (updatedGoal && updatedGoal.targetAmount > 0) {
        const progressPercentage = (updatedGoal.currentAmount / updatedGoal.targetAmount) * 100
        const previousPercentage = (previousAmount / updatedGoal.targetAmount) * 100

        if (progressPercentage >= 100) {
          toast({
            title: "Goal completed",
            description: `Congratulations! You've reached your "${goalName}" goal!`,
            duration: 7000
          })
        } else if (progressPercentage >= 75 && previousPercentage < 75) {
          toast({
            title: "Milestone reached",
            description: `You're 75% of the way to your "${goalName}" goal!`,
            duration: 5000
          })
        } else if (progressPercentage >= 50 && previousPercentage < 50) {
          toast({
            title: "Halfway there",
            description: `You're 50% of the way to your "${goalName}" goal!`,
            duration: 5000
          })
        }
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Failed to add contribution"
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive"
      })
    }
  }

  const getProgressPercentage = (goal: SavingsGoal) => {
    if (goal.targetAmount <= 0) return 0
    return Math.min((goal.currentAmount / goal.targetAmount) * 100, 100)
  }

  const getDaysRemaining = (targetDate: string) => {
    const today = new Date()
    const target = new Date(targetDate)
    return differenceInDays(target, today)
  }

  const getGoalStatus = (goal: SavingsGoal) => {
    if (goal.isCompleted) return 'completed'
    
    const daysRemaining = getDaysRemaining(goal.targetDate)
    if (daysRemaining < 0) return 'overdue'
    if (daysRemaining <= 30) return 'urgent'
    return 'active'
  }

  const filteredAndSortedGoals = goals
    .filter(goal => {
      // First filter by tab (active/completed)
      const tabMatch = activeTab === 'active' ? !goal.isCompleted : goal.isCompleted
      
      // Then filter by category
      const categoryMatch = filterBy === 'all' || goal.category === filterBy
      
      return tabMatch && categoryMatch
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'priority':
          const priorityOrder = { high: 3, medium: 2, low: 1 }
          return priorityOrder[b.priority] - priorityOrder[a.priority]
        case 'deadline':
          return new Date(a.targetDate).getTime() - new Date(b.targetDate).getTime()
        case 'progress':
          return getProgressPercentage(b) - getProgressPercentage(a)
        case 'amount':
          return b.targetAmount - a.targetAmount
        default:
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      }
    })

  const totalTargetValue = goals.reduce((sum, g) => sum + g.targetAmount, 0)
  const totalSavedAmount = goals.reduce((sum, g) => sum + g.currentAmount, 0)

  const stats = {
    total: goals.length,
    active: goals.filter(g => !g.isCompleted).length,
    completed: goals.filter(g => g.isCompleted).length,
    totalValue: totalTargetValue,
    savedAmount: totalSavedAmount,
    overallProgress: totalTargetValue > 0 ? Math.min((totalSavedAmount / totalTargetValue) * 100, 999) : 0
  }

  if (loading) {
    return (
      <main className="flex-1 overflow-auto p-6 md:p-8 lg:p-10">
        <div className="max-w-7xl mx-auto">
          <div className="flex h-96 items-center justify-center">
            <LoadingSpinner size="lg" />
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="flex-1 overflow-auto p-4 sm:p-6 md:p-8 lg:p-10">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-xl sm:text-2xl md:text-3xl font-medium font-outfit">Savings Goals</h1>
            <p className="text-cream/60 text-sm mt-1 font-outfit">Track your financial goals and build wealth systematically</p>
          </div>
          <AddButton
            label="Goal"
            onClick={() => {
              setEditingGoal(null)
              resetForm()
              setShowCreateDialog(true)
            }}
          />
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6 sm:mb-8">
          <MotionContainer delay={0.1}>
            <MetricCard
              title="Total Goals"
              value={stats.total.toString()}
              secondaryValue={`${formatCurrency(stats.totalValue, { decimals: 0 })} target`}
              icon={<Target className="h-5 w-5" />}
            />
          </MotionContainer>
          <MotionContainer delay={0.2}>
            <MetricCard
              title="Active"
              value={stats.active.toString()}
              secondaryValue={`${stats.active > 0 ? Math.round((stats.active / stats.total) * 100) : 0}% of total`}
              icon={<Clock className="h-5 w-5" />}
            />
          </MotionContainer>
          <MotionContainer delay={0.3}>
            <MetricCard
              title="Completed"
              value={stats.completed.toString()}
              secondaryValue={`${stats.completed > 0 ? Math.round((stats.completed / stats.total) * 100) : 0}% of total`}
              icon={<Trophy className="h-5 w-5" />}
            />
          </MotionContainer>
          <MotionContainer delay={0.4}>
            <MetricCard
              title="Progress"
              value={`${stats.overallProgress.toFixed(1)}%`}
              secondaryValue={`${formatCurrency(stats.savedAmount, { decimals: 0 })} saved`}
              icon={<TrendingUp className="h-5 w-5" />}
            />
          </MotionContainer>
        </div>

        {/* Filters and Tabs */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full sm:w-auto">
            <TabsList className="bg-cream/5 border-cream/10">
              <TabsTrigger value="active" className="data-[state=active]:bg-cream/20">
                Active ({stats.active})
              </TabsTrigger>
              <TabsTrigger value="completed" className="data-[state=active]:bg-cream/20">
                Completed ({stats.completed})
              </TabsTrigger>
            </TabsList>
          </Tabs>
          
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <DropdownMenu>
              <DropdownMenuTrigger className="flex items-center text-cream/60 text-sm hover:text-cream bg-cream/5 px-3 py-1.5 rounded-md border border-cream/10">
                {filterBy === "all" ? "All Categories" : categories.find(cat => cat.value === filterBy)?.label || "Filter by category"}
                <ChevronRight className="h-4 w-4 ml-2 transform rotate-90" />
              </DropdownMenuTrigger>
              <DropdownMenuContent className="bg-dark border-cream/10">
                <DropdownMenuItem
                  className="text-cream hover:bg-cream/10 cursor-pointer"
                  onClick={() => setFilterBy("all")}
                >
                  All Categories
                </DropdownMenuItem>
                {categories.map(cat => (
                  <DropdownMenuItem
                    key={cat.value}
                    className="text-cream hover:bg-cream/10 cursor-pointer"
                    onClick={() => setFilterBy(cat.value)}
                  >
                    {cat.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            
            <DropdownMenu>
              <DropdownMenuTrigger className="flex items-center text-cream/60 text-sm hover:text-cream bg-cream/5 px-3 py-1.5 rounded-md border border-cream/10">
                {sortBy === "priority" ? "Priority" : sortBy === "deadline" ? "Deadline" : sortBy === "progress" ? "Progress" : sortBy === "amount" ? "Amount" : "Created Date"}
                <ChevronRight className="h-4 w-4 ml-2 transform rotate-90" />
              </DropdownMenuTrigger>
              <DropdownMenuContent className="bg-dark border-cream/10">
                <DropdownMenuItem
                  className="text-cream hover:bg-cream/10 cursor-pointer"
                  onClick={() => setSortBy("priority")}
                >
                  Priority
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-cream hover:bg-cream/10 cursor-pointer"
                  onClick={() => setSortBy("deadline")}
                >
                  Deadline
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-cream hover:bg-cream/10 cursor-pointer"
                  onClick={() => setSortBy("progress")}
                >
                  Progress
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-cream hover:bg-cream/10 cursor-pointer"
                  onClick={() => setSortBy("amount")}
                >
                  Amount
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-cream hover:bg-cream/10 cursor-pointer"
                  onClick={() => setSortBy("created")}
                >
                  Created Date
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Goals Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <AnimatePresence>
            {filteredAndSortedGoals.map((goal, index) => {
              const progressPercentage = getProgressPercentage(goal)
              const daysRemaining = getDaysRemaining(goal.targetDate)
              const status = getGoalStatus(goal)
              const categoryInfo = categories.find(c => c.value === goal.category)
              const IconComponent = categoryInfo?.icon || Bookmark
              const priorityInfo = priorityConfig[goal.priority] ?? defaultPriorityConfig

              return (
                <MotionDiv
                  key={goal.id}
                  layout
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.3, delay: Math.min(index * 0.05, 0.4) }}
                >
                  <Card className={cn(
                    "relative overflow-hidden bg-cream/5 border-cream/20 hover:bg-cream/10 transition-all duration-300 h-full",
                    goal.isCompleted && "border-green-300/40 bg-green-50/5",
                    status === 'overdue' && "border-red-300/40 bg-red-50/5",
                    status === 'urgent' && "border-yellow-300/40 bg-yellow-50/5"
                  )}>
                    <CardHeader className="pb-4">
                      <div className="flex items-start justify-between">
                        <div className="space-y-2 flex-1 min-w-0">
                          <CardTitle className="text-lg flex items-center gap-3 text-cream/90">
                            <div className="h-10 w-10 rounded-full bg-cream/10 flex items-center justify-center flex-shrink-0">
                              <IconComponent className="h-5 w-5 text-cream/60" />
                            </div>
                            <span className="truncate">{goal.name}</span>
                            {goal.isCompleted && <Trophy className="h-5 w-5 text-green-400 flex-shrink-0" />}
                          </CardTitle>
                          
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge variant="outline" className={cn("text-xs border-cream/20", priorityInfo.color)}>
                              {priorityInfo.label}
                            </Badge>
                            <Badge variant="outline" className={cn("text-xs border-cream/20", categoryInfo?.color)}>
                              {categoryInfo?.label}
                            </Badge>
                            {status === 'overdue' && (
                              <Badge variant="destructive" className="text-xs">
                                <AlertCircle className="h-3 w-3 mr-1" />
                                Overdue
                              </Badge>
                            )}
                            {status === 'urgent' && (
                              <Badge className="text-xs bg-yellow-500/20 text-yellow-400">
                                <Clock className="h-3 w-3 mr-1" />
                                {daysRemaining} days left
                              </Badge>
                            )}
                          </div>
                        </div>
                        
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openEditDialog(goal)}>
                              <Edit className="h-4 w-4 mr-2" />
                              Edit Goal
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={() => {
                                setSelectedGoal(goal)
                                setShowContributionDialog(true)
                              }}
                              disabled={goal.isCompleted}
                            >
                              <DollarSign className="h-4 w-4 mr-2" />
                              Add Money
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={() => {
                                setViewContributionsGoal(goal)
                                setShowContributionsViewDialog(true)
                              }}
                              disabled={!goal.contributions || goal.contributions.length === 0}
                            >
                              <PieChart className="h-4 w-4 mr-2" />
                              View Contributions ({goal.contributions?.length || 0})
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={() => setGoalToDelete(goal.id)}
                              className="text-red-600"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete Goal
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </CardHeader>

                    <CardContent className="space-y-6 pb-6">
                      {goal.description && (
                        <p className="text-sm text-cream/60 leading-relaxed">{goal.description}</p>
                      )}

                      {/* Progress Section */}
                      <div className="space-y-3">
                        <div className="flex justify-between items-center text-sm">
                          <span className="font-medium text-cream/70">
                            {formatCurrency(goal.currentAmount, { decimals: 0 })}
                          </span>
                          <span className="font-medium text-cream/70">
                            {formatCurrency(goal.targetAmount, { decimals: 0 })}
                          </span>
                        </div>
                        
                        <div className="w-full bg-cream/10 rounded-full h-3">
                          <div 
                            className={cn(
                              "h-3 rounded-full transition-all duration-500 ease-out",
                              goal.isCompleted ? "bg-green-400" : "bg-cream/30"
                            )}
                            style={{ width: `${progressPercentage}%` }}
                          />
                        </div>
                        
                        <div className="flex justify-between items-center">
                          <span className="text-lg font-semibold text-cream/80">
                            {progressPercentage.toFixed(1)}% Complete
                          </span>
                          <span className="text-sm text-cream/60">
                            {goal.currentAmount > goal.targetAmount
                              ? `Over target by ${formatCurrency((goal.currentAmount - goal.targetAmount), { decimals: 0 })}`
                              : `${formatCurrency((goal.targetAmount - goal.currentAmount), { decimals: 0 })} remaining`}
                          </span>
                        </div>
                      </div>

                      {/* Timeline and Contributions */}
                      <div className="bg-cream/5 rounded-lg p-4 border border-cream/10 space-y-3">
                        <div className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2">
                            <CalendarIcon className="h-4 w-4 text-cream/60" />
                            <span className="text-cream/70">Target Date</span>
                          </div>
                          <span className="font-medium text-cream/80">
                            {format(new Date(goal.targetDate), "MMM dd, yyyy")}
                          </span>
                        </div>
                        {!goal.isCompleted && (
                          <div className="text-xs text-cream/60">
                            {daysRemaining > 0 ? `${daysRemaining} days remaining` : `${Math.abs(daysRemaining)} days overdue`}
                          </div>
                        )}
                        
                        {goal.contributions && goal.contributions.length > 0 && (
                          <div className="flex items-center justify-between text-sm pt-2 border-t border-cream/10">
                            <div className="flex items-center gap-2">
                              <DollarSign className="h-4 w-4 text-cream/60" />
                              <span className="text-cream/70">Contributions</span>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-auto p-1 text-xs text-cream/80 hover:text-cream"
                              onClick={() => {
                                setViewContributionsGoal(goal)
                                setShowContributionsViewDialog(true)
                              }}
                            >
                              {goal.contributions.length} transaction{goal.contributions.length !== 1 ? 's' : ''}
                              <ChevronRight className="h-3 w-3 ml-1" />
                            </Button>
                          </div>
                        )}
                      </div>
                    </CardContent>

                    {/* Completion Overlay */}
                    {goal.isCompleted && (
                      <div className="absolute inset-0 bg-green-500/10 flex items-center justify-center backdrop-blur-[1px]">
                        <div className="bg-green-500/20 text-green-100 px-6 py-3 rounded-lg text-sm font-medium border border-green-400/30 shadow-sm flex items-center gap-2">
                          <CheckCircle className="h-4 w-4" />
                          Goal Completed
                        </div>
                      </div>
                    )}
                  </Card>
                </MotionDiv>
              )
            })}
          </AnimatePresence>
        </div>

        {/* Empty State */}
        {filteredAndSortedGoals.length === 0 && (
          <EmptyState
            size="lg"
            icon={Target}
            title={
              activeTab === 'completed'
                ? filterBy === 'all'
                  ? 'No completed goals yet'
                  : `No completed ${categories.find(c => c.value === filterBy)?.label.toLowerCase()} goals yet`
                : filterBy === 'all'
                  ? 'No active goals yet'
                  : `No active ${categories.find(c => c.value === filterBy)?.label.toLowerCase()} goals yet`
            }
            description={
              activeTab === 'completed'
                ? filterBy === 'all'
                  ? 'Complete your first goal to see it here!'
                  : `Complete your first ${categories.find(c => c.value === filterBy)?.label.toLowerCase()} goal to see it here!`
                : filterBy === 'all'
                  ? 'Create your first savings goal to start building wealth and tracking your financial progress.'
                  : `Create your first ${categories.find(c => c.value === filterBy)?.label.toLowerCase()} goal to start building toward this important milestone.`
            }
            action={
              activeTab === 'active' ? (
                <Button
                  onClick={() => {
                    setEditingGoal(null)
                    resetForm()
                    // Set the form category to match the current filter if it's not "all"
                    if (filterBy !== 'all') {
                      setFormData(prev => ({ ...prev, category: filterBy }))
                    }
                    setShowCreateDialog(true)
                  }}
                  className="bg-cream/10 hover:bg-cream/20 text-cream/80 border-cream/20 h-11 px-6"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  {filterBy === 'all'
                    ? 'Create Your First Goal'
                    : `Create ${categories.find(c => c.value === filterBy)?.label} Goal`
                  }
                </Button>
              ) : undefined
            }
          />
        )}

        {/* Create/Edit Goal Dialog */}
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="text-xl">
                {editingGoal ? 'Edit Goal' : 'Create New Goal'}
              </DialogTitle>
            </DialogHeader>
            
            <form onSubmit={handleSubmit} className="space-y-6 py-4">
              <div className="space-y-2">
                <Label htmlFor="name" className="text-sm font-medium">Goal Name *</Label>
                <Input
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  placeholder="e.g., Emergency fund, Dream vacation..."
                  className="h-11"
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="description" className="text-sm font-medium">Description</Label>
                <Textarea
                  id="description"
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  placeholder="Add details about your goal..."
                  className="min-h-[80px] resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="targetAmount" className="text-sm font-medium">Target Amount *</Label>
                  <Input
                    id="targetAmount"
                    name="targetAmount"
                    type="number"
                    value={formData.targetAmount}
                    onChange={handleInputChange}
                    placeholder="10000"
                    className="h-11"
                    min="1"
                    step="0.01"
                    required
                  />
                </div>
                
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Target Date *</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button 
                        variant="outline" 
                        className="w-full justify-start text-left h-11 bg-background"
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {format(formData.targetDate, "MMM dd, yyyy")}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={formData.targetDate}
                        onSelect={handleDateChange}
                        disabled={(date) => isBefore(date, startOfDay(new Date()))}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Category *</Label>
                  <Select 
                    value={formData.category} 
                    onValueChange={(value) => handleSelectChange('category', value)}
                  >
                    <SelectTrigger className="h-11">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((cat) => (
                        <SelectItem key={cat.value} value={cat.value}>
                          <div className="flex items-center gap-2">
                            <cat.icon className="h-4 w-4" />
                            {cat.label}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium">Priority</Label>
                  <Select 
                    value={formData.priority} 
                    onValueChange={(value: string) => handleSelectChange('priority', value)}
                  >
                    <SelectTrigger className="h-11">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low Priority</SelectItem>
                      <SelectItem value="medium">Medium Priority</SelectItem>
                      <SelectItem value="high">High Priority</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setShowCreateDialog(false)}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  className="flex-1"
                  disabled={!formData.name || !formData.targetAmount}
                >
                  {editingGoal ? 'Update Goal' : 'Create Goal'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* Add Contribution Dialog */}
        <Dialog open={showContributionDialog} onOpenChange={setShowContributionDialog}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Add Contribution</DialogTitle>
            </DialogHeader>
            
            <div className="space-y-4 py-4">
              {selectedGoal && (
                <div className="bg-cream/5 rounded-lg p-4 border border-cream/10">
                  <p className="font-medium text-cream/90">{selectedGoal.name}</p>
                  <p className="text-sm text-cream/60 mt-1">
                    Current: {formatCurrency(selectedGoal.currentAmount, { decimals: 0 })} / {formatCurrency(selectedGoal.targetAmount, { decimals: 0 })}
                  </p>
                </div>
              )}
              
              <div className="space-y-2">
                <Label htmlFor="contributionAmount" className="text-sm font-medium">Amount *</Label>
                <Input
                  id="contributionAmount"
                  type="number"
                  value={contributionAmount}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setContributionAmount(e.target.value)}
                  placeholder="0.00"
                  step="0.01"
                  min="0.01"
                  className="h-11"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="contributionNote" className="text-sm font-medium">Note (Optional)</Label>
                <Input
                  id="contributionNote"
                  value={contributionNote}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setContributionNote(e.target.value)}
                  placeholder="e.g., Bonus money, side hustle..."
                  className="h-11"
                />
              </div>
              
              <div className="flex gap-3 pt-4">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setShowContributionDialog(false)}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button 
                  onClick={handleAddContribution}
                  className="flex-1"
                  disabled={!Number.isFinite(parseFloat(contributionAmount)) || parseFloat(contributionAmount) <= 0}
                >
                  Add ${contributionAmount || '0.00'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* View Contributions Dialog */}
        <Dialog open={showContributionsViewDialog} onOpenChange={setShowContributionsViewDialog}>
          <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <PieChart className="h-5 w-5" />
                Contributions History
              </DialogTitle>
            </DialogHeader>
            
            {viewContributionsGoal && (
              <div className="space-y-4 py-4">
                <div className="bg-cream/5 rounded-lg p-4 border border-cream/10">
                  <h3 className="font-medium text-cream/90 mb-2">{viewContributionsGoal.name}</h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-cream/60">Total Contributions:</span>
                      <p className="text-cream/90 font-medium">
                        {viewContributionsGoal.contributions?.length || 0}
                      </p>
                    </div>
                    <div>
                      <span className="text-cream/60">Total Amount:</span>
                      <p className="text-cream/90 font-medium">
                        {formatCurrency(viewContributionsGoal.contributions?.reduce((sum, contrib) => sum + contrib.amount, 0) ?? 0, { decimals: 0 })}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <h4 className="font-medium text-cream/80">Recent Contributions</h4>
                  {viewContributionsGoal.contributions && viewContributionsGoal.contributions.length > 0 ? (
                    <div className="space-y-3">
                      {[...viewContributionsGoal.contributions]
                        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                        .map((contribution) => (
                          <div 
                            key={contribution.id} 
                            className="bg-cream/5 rounded-lg p-4 border border-cream/10 hover:bg-cream/10 transition-colors"
                          >
                            <div className="flex items-start justify-between">
                              <div className="space-y-2 flex-1">
                                <div className="flex items-center gap-2">
                                  <DollarSign className="h-4 w-4 text-green-400" />
                                  <span className="font-medium text-cream/90">
                                    {formatCurrency(contribution.amount, { decimals: 0 })}
                                  </span>
                                  <Badge variant="outline" className="text-xs">
                                    {contribution.method}
                                  </Badge>
                                </div>
                                {contribution.note && (
                                  <p className="text-sm text-cream/70 leading-relaxed">
                                    {contribution.note}
                                  </p>
                                )}
                                {contribution.source && (
                                  <p className="text-xs text-cream/50">
                                    Source: {contribution.source}
                                  </p>
                                )}
                              </div>
                              <div className="text-right text-xs text-cream/50">
                                <p>{format(new Date(contribution.date), "MMM dd, yyyy")}</p>
                                <p>{format(new Date(contribution.date), "h:mm a")}</p>
                              </div>
                            </div>
                          </div>
                        ))}
                    </div>
                  ) : (
                    <EmptyState
                      icon={DollarSign}
                      title="No contributions yet"
                      description="Start adding money to this goal to see your progress!"
                    />
                  )}
                </div>

                <div className="flex justify-end pt-4">
                  <Button 
                    onClick={() => setShowContributionsViewDialog(false)}
                    variant="outline"
                  >
                    Close
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={!!goalToDelete} onOpenChange={() => setGoalToDelete(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Goal</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete this goal? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDeleteGoal} className="bg-red-600 hover:bg-red-700">
                Delete Goal
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </main>
  )
}