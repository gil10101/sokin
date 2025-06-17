import { Request, Response } from 'express';
import { db } from '../config/firebase';
import { SavingsGoal, GoalContribution } from '../models/types';

export class GoalsController {
  
  // Get user's savings goals
  static async getUserGoals(req: Request, res: Response) {
    try {
      const userId = req.user?.uid;
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      // Development mode: Return mock data if database not available
      if (!db || process.env.NODE_ENV === 'development') {
        const mockGoals = [
          {
            id: 'goal_1',
            userId,
            name: 'Emergency Fund',
            description: 'Build an emergency fund for unexpected expenses',
            targetAmount: 10000,
            currentAmount: 2500,
            targetDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
            category: 'emergency',
            priority: 'high',
            isCompleted: false,
            createdAt: new Date().toISOString(),
            milestones: [
              { percentage: 25, amount: 2500, achievedAt: new Date().toISOString() },
              { percentage: 50, amount: 5000 },
              { percentage: 75, amount: 7500 },
              { percentage: 100, amount: 10000 }
            ],
            contributions: []
          },
          {
            id: 'goal_2',
            userId,
            name: 'Vacation Fund',
            description: 'Save for a dream vacation to Europe',
            targetAmount: 5000,
            currentAmount: 1200,
            targetDate: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString(),
            category: 'vacation',
            priority: 'medium',
            isCompleted: false,
            createdAt: new Date().toISOString(),
            milestones: [
              { percentage: 25, amount: 1250, achievedAt: new Date().toISOString() },
              { percentage: 50, amount: 2500 },
              { percentage: 75, amount: 3750 },
              { percentage: 100, amount: 5000 }
            ],
            contributions: []
          }
        ];
        
        console.log('Returning mock savings goals for development');
        return res.json({ goals: mockGoals });
      }
      
      const goalsRef = db.collection('goals');
      const snapshot = await goalsRef.where('userId', '==', userId).get();
      
      const goals = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      res.json({ goals });
    } catch (error: any) {
      console.error('Error fetching goals:', error);
      
      // Fallback to mock data if database fails
      if (process.env.NODE_ENV === 'development') {
        const userId = req.user?.uid || 'dev-user';
        const mockGoals = [
          {
            id: 'goal_1',
            userId,
            name: 'Emergency Fund',
            description: 'Build an emergency fund for unexpected expenses',
            targetAmount: 10000,
            currentAmount: 2500,
            targetDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
            category: 'emergency',
            priority: 'high',
            isCompleted: false,
            createdAt: new Date().toISOString(),
            milestones: [
              { percentage: 25, amount: 2500, achievedAt: new Date().toISOString() },
              { percentage: 50, amount: 5000 },
              { percentage: 75, amount: 7500 },
              { percentage: 100, amount: 10000 }
            ],
            contributions: []
          }
        ];
        
        console.log('Database error - returning fallback mock goals');
        return res.json({ goals: mockGoals });
      }
      
      res.status(500).json({ error: 'Failed to fetch goals' });
    }
  }

  // Create new savings goal
  static async createGoal(req: Request, res: Response) {
    try {
      const userId = req.user?.uid;
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const goalData: Omit<SavingsGoal, 'id'> = {
        userId,
        name: req.body.name,
        description: req.body.description,
        targetAmount: req.body.targetAmount,
        currentAmount: 0,
        targetDate: req.body.targetDate,
        category: req.body.category,
        priority: req.body.priority,
        isCompleted: false,
        createdAt: new Date().toISOString(),
        milestones: req.body.milestones || [
          { percentage: 25, amount: req.body.targetAmount * 0.25 },
          { percentage: 50, amount: req.body.targetAmount * 0.5 },
          { percentage: 75, amount: req.body.targetAmount * 0.75 },
          { percentage: 100, amount: req.body.targetAmount }
        ],
        contributions: []
      };

      const docRef = await db?.collection('goals').add(goalData);
      const newGoal = { id: docRef?.id, ...goalData };

      res.status(201).json({ goal: newGoal });
    } catch (error: any) {
      console.error('Error creating goal:', error);
      res.status(500).json({ error: 'Failed to create goal' });
    }
  }

  // Add contribution to goal
  static async addContribution(req: Request, res: Response) {
    try {
      const userId = req.user?.uid;
      const { goalId } = req.params;
      const { amount, method, source } = req.body;

      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const goalRef = db?.collection('goals').doc(goalId);
      const goalDoc = await goalRef?.get();

      if (!goalDoc?.exists) {
        return res.status(404).json({ error: 'Goal not found' });
      }

      const goalData = goalDoc.data() as SavingsGoal;
      
      if (goalData.userId !== userId) {
        return res.status(403).json({ error: 'Forbidden' });
      }

      const contribution: GoalContribution = {
        amount,
        date: new Date().toISOString(),
        method: method || 'manual',
        source
      };

      const newCurrentAmount = goalData.currentAmount + amount;
      const isCompleted = newCurrentAmount >= goalData.targetAmount;

      // Update milestones
      const updatedMilestones = goalData.milestones?.map(milestone => ({
        ...milestone,
        achievedAt: newCurrentAmount >= milestone.amount && !milestone.achievedAt 
          ? new Date().toISOString() 
          : milestone.achievedAt
      }));

      await goalRef?.update({
        currentAmount: newCurrentAmount,
        contributions: [...(goalData.contributions || []), contribution],
        milestones: updatedMilestones,
        isCompleted,
        completedAt: isCompleted ? new Date().toISOString() : goalData.completedAt,
        updatedAt: new Date().toISOString()
      });

      res.json({ 
        success: true, 
        currentAmount: newCurrentAmount,
        isCompleted
      });
    } catch (error: any) {
      console.error('Error adding contribution:', error);
      res.status(500).json({ error: 'Failed to add contribution' });
    }
  }

  // Update goal
  static async updateGoal(req: Request, res: Response) {
    try {
      const userId = req.user?.uid;
      const { goalId } = req.params;

      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const goalRef = db?.collection('goals').doc(goalId);
      const goalDoc = await goalRef?.get();

      if (!goalDoc?. exists) {
        return res.status(404).json({ error: 'Goal not found' });
      }

      const goalData = goalDoc.data() as SavingsGoal;
      
      if (goalData.userId !== userId) {
        return res.status(403).json({ error: 'Forbidden' });
      }

      const updateData = {
        ...req.body,
        updatedAt: new Date().toISOString()
      };

      await goalRef?.update(updateData);

      res.json({ success: true });
    } catch (error: any) {
      console.error('Error updating goal:', error);
      res.status(500).json({ error: 'Failed to update goal' });
    }
  }

  // Delete goal
  static async deleteGoal(req: Request, res: Response) {
    try {
      const userId = req.user?.uid;
      const { goalId } = req.params;

      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const goalRef = db?.collection('goals').doc(goalId);
      const goalDoc = await goalRef?.get();

      if (!goalDoc?.exists) {
        return res.status(404).json({ error: 'Goal not found' });
      }

      const goalData = goalDoc.data() as SavingsGoal;
      
      if (goalData.userId !== userId) {
        return res.status(403).json({ error: 'Forbidden' });
      }

      await goalRef?.delete();

      res.json({ success: true });
    } catch (error: any) {
      console.error('Error deleting goal:', error);
      res.status(500).json({ error: 'Failed to delete goal' });
    }
  }
} 