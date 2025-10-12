"use client"



import { useState, useEffect } from 'react'
import { collection, query, where, orderBy, getDocs, addDoc, doc, updateDoc } from "firebase/firestore"
import { db } from '../../lib/firebase'
import { useAuth } from '../../contexts/auth-context'
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
  Bookmark
} from 'lucide-react'
import { format } from 'date-fns'
import { motion, AnimatePresence } from 'framer-motion'
import { useToast } from '../../hooks/use-toast'
import { cn } from '../../lib/utils'

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

interface SavingsGoalsProps {
  hideHeader?: boolean
}

export function SavingsGoals({ hideHeader = false }: SavingsGoalsProps) {
  const { user } = useAuth()
  const [goals, setGoals] = useState<SavingsGoal[]>([])  
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showCreateGoal, setShowCreateGoal] = useState(false)
  const [selectedGoal, setSelectedGoal] = useState<SavingsGoal | null>(null)
  const [contributionAmount, setContributionAmount] = useState('')
  const [contributionNote, setContributionNote] = useState('')
  const { toast } = useToast()

  // Form state for new goal
  const [newGoal, setNewGoal] = useState<{
    name: string
    description: string
    targetAmount: string
    targetDate: Date
    category: string
    priority: 'low' | 'medium' | 'high'
  }>({
    name: '',
    description: '',
    targetAmount: '',
    targetDate: new Date(),
    category: 'emergency',
    priority: 'medium'
  })

  const categories = [
    { value: 'emergency', label: 'Emergency Fund', icon: Shield },
    { value: 'vacation', label: 'Vacation', icon: MapPin },
    { value: 'home', label: 'Home/Property', icon: Home },
    { value: 'car', label: 'Vehicle', icon: Car },
    { value: 'education', label: 'Education', icon: GraduationCap },
    { value: 'retirement', label: 'Retirement', icon: User },
    { value: 'other', label: 'Other', icon: Bookmark }
  ]

  const priorityColors = {
    low: 'bg-gray-100 text-gray-800',
    medium: 'bg-yellow-100 text-yellow-800',
    high: 'bg-red-100 text-red-800'
  }

  const fetchSavingsGoals = async () => {
    if (!user) return

    setLoading(true)
    setError(null)
    try {
      const goalsRef = collection(db, "goals")
      const q = query(
        goalsRef, 
        where("userId", "==", user.uid), 
        orderBy("createdAt", "desc")
      )

      const querySnapshot = await getDocs(q)
      const goalsData = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as SavingsGoal[]

      setGoals(goalsData)
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "There was an error loading your savings goals";

      setError('Failed to load savings goals. Please try again.')
      toast({
        title: "Error loading goals",
        description: errorMessage,
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const createGoal = async () => {
    if (!user || !newGoal.name || !newGoal.targetAmount) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields",
        variant: "destructive"
      })
      return
    }

    try {
      const goalData = {
        userId: user.uid,
        name: newGoal.name,
        description: newGoal.description,
        targetAmount: parseFloat(newGoal.targetAmount),
        currentAmount: 0,
        targetDate: newGoal.targetDate.toISOString(),
        category: newGoal.category,
        priority: newGoal.priority,
        isCompleted: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }

      await addDoc(collection(db, "goals"), goalData)
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
        title: "Goal Created",
        description: `Your goal "${goalData.name}" has been created successfully.`
      })
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Failed to create savings goal";

      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive"
      })
    }
  }

  const addContribution = async () => {
    if (!selectedGoal || !contributionAmount) return

    const amount = parseFloat(contributionAmount)
    if (amount <= 0) {
      toast({
        title: "Invalid Amount",
        description: "Please enter a valid contribution amount",
        variant: "destructive"
      })
      return
    }

    try {
      const newCurrentAmount = selectedGoal.currentAmount + amount
      const goalRef = doc(db, "goals", selectedGoal.id!)
      
      await updateDoc(goalRef, {
        currentAmount: newCurrentAmount,
        updatedAt: new Date().toISOString(),
        isCompleted: newCurrentAmount >= selectedGoal.targetAmount
      })

      // Check for milestones
      const progressPercentage = (newCurrentAmount / selectedGoal.targetAmount) * 100
      if (progressPercentage >= 100) {
        toast({
          title: "Goal Completed",
          description: `Congratulations! You have successfully achieved your "${selectedGoal.name}" savings goal.`,
          duration: 7000
        })
      } else if (progressPercentage >= 75 && selectedGoal.currentAmount / selectedGoal.targetAmount < 0.75) {
        toast({
          title: "Milestone Achieved",
          description: `You have reached 75% of your "${selectedGoal.name}" savings target.`,
          duration: 5000
        })
      } else if (progressPercentage >= 50 && selectedGoal.currentAmount / selectedGoal.targetAmount < 0.50) {
        toast({
          title: "Progress Update",
          description: `You have reached 50% of your "${selectedGoal.name}" savings target.`,
          duration: 5000
        })
      }

      await fetchSavingsGoals()
      setContributionAmount('')
      setContributionNote('')
      setSelectedGoal(null)
      
      toast({
        title: "Contribution Added",
        description: `$${amount.toLocaleString()} has been added to your goal.`
      })
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Failed to add contribution";

      toast({
        title: "Error",
        description: errorMessage,
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
          title: "Milestone Reached",
          description: `You've reached ${milestone.percentage}% of your "${goal.name}" goal!`,
          duration: 5000
        })
      }
    })

    if (newTotal >= goal.targetAmount && !goal.isCompleted) {
      toast({
        title: "Goal Completed",
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

  // Load savings goals on component mount and when user changes
  useEffect(() => {
    fetchSavingsGoals()
  }, [user])

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="h-8 w-48 bg-cream/10 rounded animate-pulse mb-2" />
            <div className="h-4 w-96 bg-cream/5 rounded animate-pulse" />
          </div>
          <div className="h-10 w-24 bg-cream/10 rounded animate-pulse" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6 max-w-7xl mx-auto">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-80 bg-cream/5 rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-8 max-w-7xl mx-auto">
        {!hideHeader && (
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <h2 className="text-3xl font-semibold text-cream/90">Savings Goals</h2>
              <p className="text-cream/60">Track your financial goals and celebrate milestones</p>
            </div>
          </div>
        )}
        
        <div className="flex flex-col items-center justify-center py-12 px-4">
          <div className="bg-cream/5 border border-cream/20 rounded-lg p-8 text-center max-w-md mx-auto">
            <div className="text-cream/40 mb-4">
              <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-cream/80 mb-2">Unable to Load Goals</h3>
            <p className="text-cream/60 mb-6 text-sm">{error}</p>

            <Button
              onClick={fetchSavingsGoals}
              className="bg-cream/10 hover:bg-cream/20 text-cream/80 border-cream/20"
            >
              Try Again
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      {!hideHeader && (
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h2 className="text-3xl font-semibold text-cream/90">Savings Goals</h2>
            <p className="text-cream/60">Track your financial goals and celebrate milestones</p>
          </div>
          <Dialog open={showCreateGoal} onOpenChange={setShowCreateGoal}>
            <DialogTrigger asChild>
              <Button className="bg-cream/10 hover:bg-cream/20 text-cream/80 border-cream/20 h-11 px-6">
                <Plus className="mr-2 h-4 w-4" />
                New Goal
              </Button>
            </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="text-xl">Create Savings Goal</DialogTitle>
            </DialogHeader>
            <div className="space-y-6 py-4">
              <div className="space-y-2">
                <Label htmlFor="name" className="text-sm font-medium">Goal Name</Label>
    
                <Input
                  id="name"
                  value={newGoal.name}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewGoal({ ...newGoal, name: e.target.value })}
                  placeholder="Emergency fund, vacation, etc."
                  className="h-11"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="description" className="text-sm font-medium">Description (Optional)</Label>
    
                <Textarea
                  id="description"
                  value={newGoal.description}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setNewGoal({ ...newGoal, description: e.target.value })}
                  placeholder="Details about your goal..."
                  className="min-h-[80px] resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="targetAmount" className="text-sm font-medium">Target Amount</Label>
      
                  <Input
                    id="targetAmount"
                    type="number"
                    value={newGoal.targetAmount}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewGoal({ ...newGoal, targetAmount: e.target.value })}
                    placeholder="10000"
                    className="h-11"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Target Date</Label>
      
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-start text-left h-11">
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
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Category</Label>
      
                  <Select
                    value={newGoal.category}
                    onValueChange={(value) => setNewGoal({ ...newGoal, category: value })}
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
                    value={newGoal.priority}
                    onValueChange={(value: 'low' | 'medium' | 'high') => setNewGoal({ ...newGoal, priority: value })}
                  >
                    <SelectTrigger className="h-11">
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
                className="w-full h-11 mt-6"
                disabled={!newGoal.name || !newGoal.targetAmount}
              >
                Create Goal
              </Button>
            </div>
          </DialogContent>
        </Dialog>
        </div>
      )}

      {/* Goals Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-7xl mx-auto">
        <AnimatePresence>
          {goals.map((goal) => {
            const progressPercentage = getProgressPercentage(goal)
            const daysRemaining = getDaysRemaining(goal.targetDate)
            const nextMilestone = getNextMilestone(goal)
            const categoryInfo = categories.find(c => c.value === goal.category)
            const IconComponent = categoryInfo?.icon || Bookmark

            return (
              <motion.div
                key={goal.id}
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.2 }}
                className="w-full"
              >
    
                <Card className={cn(
                  "relative overflow-hidden bg-cream/5 border-cream/20 hover:bg-cream/10 transition-colors h-full flex flex-col",
                  goal.isCompleted && "border-cream/40"
                )}>
                  <CardHeader className="pb-4">
                    <div className="flex items-start justify-between">
                      <div className="space-y-2 flex-1 min-w-0">
                        <CardTitle className="text-lg flex items-center gap-3 text-cream/90">
                          <div className="h-8 w-8 rounded-full bg-cream/10 flex items-center justify-center flex-shrink-0">
                            <IconComponent className="h-4 w-4 text-cream/60" />
                          </div>
                          <span className="truncate">{goal.name}</span>
                          {goal.isCompleted && <Trophy className="h-4 w-4 text-cream/60 flex-shrink-0" />}
                        </CardTitle>
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="outline" className="text-xs border-cream/20 text-cream/60">
                            {goal.priority}
                          </Badge>
                          <Badge variant="outline" className="text-xs border-cream/20 text-cream/60">
                            {daysRemaining > 0 ? `${daysRemaining} days left` : 'Overdue'}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-6 pb-6 flex-1 flex flex-col">
                    {/* Progress Section */}
                    <div className="space-y-3">
                      <div className="flex justify-between text-sm text-cream/70">
                        <span className="font-medium">${goal.currentAmount.toLocaleString()}</span>
                        <span className="font-medium">${goal.targetAmount.toLocaleString()}</span>
                      </div>
                      <div className="w-full bg-cream/10 rounded-full h-4">
                        <div 
                          className="bg-cream/30 h-4 rounded-full transition-all duration-500 ease-out" 
                          style={{ width: `${progressPercentage}%` }}
                        />
                      </div>
                      <div className="text-center">
                        <span className="text-lg font-semibold text-cream/80">
                          {progressPercentage.toFixed(1)}%
                        </span>
                        <span className="text-sm text-cream/60 ml-1">Complete</span>
                      </div>
                    </div>

                    {/* Next Milestone */}
                    {nextMilestone && (
                      <div className="bg-cream/5 rounded-lg p-4 border border-cream/10">
                        <div className="flex items-center gap-3 mb-2">
                          <Target className="h-4 w-4 text-cream/60" />
                          <span className="text-sm font-medium text-cream/80">
                            Next Milestone: {nextMilestone.percentage}%
                          </span>
                        </div>
                        <div className="text-sm text-cream/60">
                          ${(nextMilestone.amount - goal.currentAmount).toLocaleString()} remaining
                        </div>
                      </div>
                    )}

                    {/* Action Buttons */}
                    <div className="flex gap-3 pt-2 mt-auto">
          
                      <Button
                        size="sm"
                        className="flex-1 bg-cream/10 hover:bg-cream/20 text-cream/80 border-cream/20 h-10"
                        disabled={goal.isCompleted}
                        onClick={() => setSelectedGoal(goal)}
                      >
                        <DollarSign className="mr-2 h-4 w-4" />
                        Add Money
                      </Button>

          
                      <Button size="sm" variant="outline" className="border-cream/20 text-cream/60 hover:bg-cream/10 h-10 px-3">
                        <TrendingUp className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>

                  {/* Completion Overlay */}
                  {goal.isCompleted && (
                    <div className="absolute inset-0 bg-cream/10 flex items-center justify-center backdrop-blur-[1px]">
                      <div className="bg-cream/20 text-cream/80 px-4 py-2 rounded-lg text-sm font-medium border border-cream/30 shadow-sm">
                        Goal Completed
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
        <div className="text-center py-16">
          <div className="max-w-md mx-auto">
            <Target className="h-16 w-16 text-cream/40 mx-auto mb-6" />
            <h3 className="text-xl font-medium mb-3 text-cream/70">No savings goals yet</h3>
            <p className="text-cream/50 mb-8 leading-relaxed">
              Create your first savings goal to start tracking your financial progress and build healthy saving habits.
            </p>

            <Button
              onClick={() => setShowCreateGoal(true)}
              className="bg-cream/10 hover:bg-cream/20 text-cream/80 border-cream/20 h-11 px-6"
            >
              <Plus className="mr-2 h-4 w-4" />
              Create Your First Goal
            </Button>
          </div>
        </div>
      )}

      {/* Add Contribution Dialog */}
      <Dialog open={!!selectedGoal} onOpenChange={() => setSelectedGoal(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Contribution</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {selectedGoal && (
              <div className="bg-cream/5 rounded-lg p-4 border border-cream/10">
                <p className="font-medium text-cream/90">{selectedGoal.name}</p>
                <p className="text-sm text-cream/60 mt-1">
                  Current: ${selectedGoal.currentAmount.toLocaleString()} / ${selectedGoal.targetAmount.toLocaleString()}
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
                onClick={() => setSelectedGoal(null)}
                className="flex-1"
              >
                Cancel
              </Button>
  
              <Button
                onClick={addContribution}
                className="flex-1"
                disabled={!contributionAmount || parseFloat(contributionAmount) <= 0}
              >
                Add ${contributionAmount || '0.00'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
} 