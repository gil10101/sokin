"use client"

import { useState, useEffect } from 'react'
import { Button } from '../ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../ui/dialog'
import { Input } from '../ui/input'
import { Label } from '../ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select'
import { Progress } from '../ui/progress'
import { Badge } from '../ui/badge'
import { Textarea } from '../ui/textarea'
import { Calendar } from '../ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover'
import { Plus, Target, Calendar as CalendarIcon, TrendingUp, Trophy, DollarSign } from 'lucide-react'
import { format } from 'date-fns'
import { motion, AnimatePresence } from 'framer-motion'
import { useToast } from '../../hooks/use-toast'
import { cn } from '../../../../lib/utils'

interface SavingsGoal {
  id?: string
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
  amount: number
  date: string
  method: 'manual' | 'automatic' | 'roundup'
  source?: string
}

export function SavingsGoals() {
  const [goals, setGoals] = useState<SavingsGoal[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateGoal, setShowCreateGoal] = useState(false)
  const [selectedGoal, setSelectedGoal] = useState<SavingsGoal | null>(null)
  const [contributionAmount, setContributionAmount] = useState('')
  const { toast } = useToast()

  // Form state for new goal
  const [newGoal, setNewGoal] = useState({
    name: '',
    description: '',
    targetAmount: '',
    targetDate: new Date(),
    category: 'emergency',
    priority: 'medium' as const
  })

  const categories = [
    { value: 'emergency', label: 'Emergency Fund', icon: '🛡️' },
    { value: 'vacation', label: 'Vacation', icon: '🏖️' },
    { value: 'home', label: 'Home/Property', icon: '🏠' },
    { value: 'car', label: 'Vehicle', icon: '🚗' },
    { value: 'education', label: 'Education', icon: '🎓' },
    { value: 'retirement', label: 'Retirement', icon: '👴' },
    { value: 'other', label: 'Other', icon: '🎯' }
  ]

  const priorityColors = {
    low: 'bg-gray-100 text-gray-800',
    medium: 'bg-yellow-100 text-yellow-800',
    high: 'bg-red-100 text-red-800'
  }

  useEffect(() => {
    fetchSavingsGoals()
  }, [])

  const fetchSavingsGoals = async () => {
    setLoading(true)
    try {
      // Fetch goals from API
      const response = await fetch('/api/goals')
      if (response.ok) {
        const data = await response.json()
        setGoals(data.goals || [])
      }
    } catch (error) {
      console.error('Error fetching goals:', error)
      toast({
        title: "Error",
        description: "Failed to load savings goals",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  const createGoal = async () => {
    try {
      const goalData = {
        ...newGoal,
        targetAmount: parseFloat(newGoal.targetAmount),
        currentAmount: 0,
        isCompleted: false,
        milestones: [
          { percentage: 25, amount: parseFloat(newGoal.targetAmount) * 0.25 },
          { percentage: 50, amount: parseFloat(newGoal.targetAmount) * 0.5 },
          { percentage: 75, amount: parseFloat(newGoal.targetAmount) * 0.75 },
          { percentage: 100, amount: parseFloat(newGoal.targetAmount) }
        ]
      }

      const response = await fetch('/api/goals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(goalData)
      })

      if (response.ok) {
        await fetchSavingsGoals()
        setShowCreateGoal(false)
        setNewGoal({
          name: '',
          description: '',
          targetAmount: '',
          targetDate: new Date(),
          category: 'emergency',
          priority: 'medium'
        })
        toast({
          title: "Goal Created!",
          description: `Your goal "${goalData.name}" has been created successfully.`
        })
      }
    } catch (error) {
      console.error('Error creating goal:', error)
      toast({
        title: "Error",
        description: "Failed to create savings goal",
        variant: "destructive"
      })
    }
  }

  const addContribution = async (goalId: string, amount: number) => {
    try {
      const response = await fetch(`/api/goals/${goalId}/contribute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          amount,
          method: 'manual',
          date: new Date().toISOString()
        })
      })

      if (response.ok) {
        await fetchSavingsGoals()
        setContributionAmount('')
        setSelectedGoal(null)
        
        // Check for milestone achievements
        const updatedGoal = goals.find(g => g.id === goalId)
        if (updatedGoal) {
          checkMilestoneAchievements(updatedGoal, amount)
        }

        toast({
          title: "Contribution Added!",
          description: `$${amount.toFixed(2)} added to your goal.`
        })
      }
    } catch (error) {
      console.error('Error adding contribution:', error)
      toast({
        title: "Error",
        description: "Failed to add contribution",
        variant: "destructive"
      })
    }
  }

  const checkMilestoneAchievements = (goal: SavingsGoal, newContribution: number) => {
    const newTotal = goal.currentAmount + newContribution
    const progressPercentage = (newTotal / goal.targetAmount) * 100

    goal.milestones?.forEach(milestone => {
      if (progressPercentage >= milestone.percentage && !milestone.achievedAt) {
        toast({
          title: "🎉 Milestone Reached!",
          description: `You've reached ${milestone.percentage}% of your "${goal.name}" goal!`,
          duration: 5000
        })
      }
    })

    if (newTotal >= goal.targetAmount && !goal.isCompleted) {
      toast({
        title: "🏆 Goal Completed!",
        description: `Congratulations! You've completed your "${goal.name}" goal!`,
        duration: 7000
      })
    }
  }

  const getProgressPercentage = (goal: SavingsGoal) => {
    return Math.min((goal.currentAmount / goal.targetAmount) * 100, 100)
  }

  const getDaysRemaining = (targetDate: string) => {
    const today = new Date()
    const target = new Date(targetDate)
    const diffTime = target.getTime() - today.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    return diffDays
  }

  const getNextMilestone = (goal: SavingsGoal) => {
    const progressPercentage = getProgressPercentage(goal)
    return goal.milestones?.find(milestone => 
      milestone.percentage > progressPercentage && !milestone.achievedAt
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Savings Goals</h2>
          <p className="text-muted-foreground">Track your financial goals and celebrate milestones</p>
        </div>
        <Dialog open={showCreateGoal} onOpenChange={setShowCreateGoal}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              New Goal
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Create Savings Goal</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="name">Goal Name</Label>
                <Input
                  id="name"
                  value={newGoal.name}
                  onChange={(e) => setNewGoal({ ...newGoal, name: e.target.value })}
                  placeholder="Emergency fund, vacation, etc."
                />
              </div>
              
              <div>
                <Label htmlFor="description">Description (Optional)</Label>
                <Textarea
                  id="description"
                  value={newGoal.description}
                  onChange={(e) => setNewGoal({ ...newGoal, description: e.target.value })}
                  placeholder="Details about your goal..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="targetAmount">Target Amount</Label>
                  <Input
                    id="targetAmount"
                    type="number"
                    value={newGoal.targetAmount}
                    onChange={(e) => setNewGoal({ ...newGoal, targetAmount: e.target.value })}
                    placeholder="10000"
                  />
                </div>
                
                <div>
                  <Label>Target Date</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-start text-left">
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {format(newGoal.targetDate, "MMM dd, yyyy")}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={newGoal.targetDate}
                        onSelect={(date) => date && setNewGoal({ ...newGoal, targetDate: date })}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Category</Label>
                  <Select 
                    value={newGoal.category} 
                    onValueChange={(value) => setNewGoal({ ...newGoal, category: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((cat) => (
                        <SelectItem key={cat.value} value={cat.value}>
                          {cat.icon} {cat.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Priority</Label>
                  <Select 
                    value={newGoal.priority} 
                    onValueChange={(value: any) => setNewGoal({ ...newGoal, priority: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Button 
                onClick={createGoal} 
                className="w-full"
                disabled={!newGoal.name || !newGoal.targetAmount}
              >
                Create Goal
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Goals Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        <AnimatePresence>
          {goals.map((goal) => {
            const progressPercentage = getProgressPercentage(goal)
            const daysRemaining = getDaysRemaining(goal.targetDate)
            const nextMilestone = getNextMilestone(goal)
            const categoryInfo = categories.find(c => c.value === goal.category)

            return (
              <motion.div
                key={goal.id}
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.2 }}
              >
                <Card className={cn(
                  "relative overflow-hidden",
                  goal.isCompleted && "ring-2 ring-green-500"
                )}>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <CardTitle className="text-lg flex items-center gap-2">
                          <span>{categoryInfo?.icon}</span>
                          {goal.name}
                          {goal.isCompleted && <Trophy className="h-4 w-4 text-yellow-500" />}
                        </CardTitle>
                        <div className="flex items-center gap-2">
                          <Badge className={cn("text-xs", priorityColors[goal.priority])}>
                            {goal.priority}
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            {daysRemaining > 0 ? `${daysRemaining} days left` : 'Overdue'}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-4">
                    {/* Progress */}
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>${goal.currentAmount.toLocaleString()}</span>
                        <span>${goal.targetAmount.toLocaleString()}</span>
                      </div>
                      <Progress value={progressPercentage} className="h-3" />
                      <div className="text-center text-sm text-muted-foreground">
                        {progressPercentage.toFixed(1)}% Complete
                      </div>
                    </div>

                    {/* Next Milestone */}
                    {nextMilestone && (
                      <div className="bg-muted/50 rounded-lg p-3">
                        <div className="flex items-center gap-2 text-sm">
                          <Target className="h-4 w-4 text-blue-500" />
                          <span>Next: {nextMilestone.percentage}% milestone</span>
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          ${(nextMilestone.amount - goal.currentAmount).toLocaleString()} to go
                        </div>
                      </div>
                    )}

                    {/* Action Buttons */}
                    <div className="flex gap-2">
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button size="sm" className="flex-1" disabled={goal.isCompleted}>
                            <DollarSign className="mr-1 h-3 w-3" />
                            Add Money
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-md">
                          <DialogHeader>
                            <DialogTitle>Add Contribution</DialogTitle>
                          </DialogHeader>
                          <div className="space-y-4">
                            <div>
                              <Label htmlFor="amount">Amount</Label>
                              <Input
                                id="amount"
                                type="number"
                                value={contributionAmount}
                                onChange={(e) => setContributionAmount(e.target.value)}
                                placeholder="0.00"
                                step="0.01"
                              />
                            </div>
                            <Button 
                              className="w-full"
                              onClick={() => {
                                const amount = parseFloat(contributionAmount)
                                if (amount > 0) {
                                  addContribution(goal.id!, amount)
                                }
                              }}
                              disabled={!contributionAmount || parseFloat(contributionAmount) <= 0}
                            >
                              Add ${contributionAmount || '0.00'}
                            </Button>
                          </div>
                        </DialogContent>
                      </Dialog>
                      
                      <Button size="sm" variant="outline">
                        <TrendingUp className="h-3 w-3" />
                      </Button>
                    </div>
                  </CardContent>

                  {/* Completion Overlay */}
                  {goal.isCompleted && (
                    <div className="absolute inset-0 bg-green-500/10 flex items-center justify-center">
                      <div className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-medium">
                        🎉 Goal Completed!
                      </div>
                    </div>
                  )}
                </Card>
              </motion.div>
            )
          })}
        </AnimatePresence>
      </div>

      {/* Empty State */}
      {goals.length === 0 && !loading && (
        <div className="text-center py-12">
          <Target className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium mb-2">No savings goals yet</h3>
          <p className="text-muted-foreground mb-4">
            Create your first savings goal to start tracking your financial progress
          </p>
          <Button onClick={() => setShowCreateGoal(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Create Your First Goal
          </Button>
        </div>
      )}
    </div>
  )
} 