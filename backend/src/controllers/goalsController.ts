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

      if (!db) {
        return res.status(500).json({ error: 'Database not initialized' });
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

      if (!db) {
        return res.status(500).json({ error: 'Database not initialized' });
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

      const docRef = await db.collection('goals').add(goalData);
      const newGoal = { id: docRef.id, ...goalData };

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
      const { amount, method, source, note } = req.body;

      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      if (!db) {
        return res.status(500).json({ error: 'Database not initialized' });
      }

      const goalRef = db.collection('goals').doc(goalId);
      const goalDoc = await goalRef.get();

      if (!goalDoc.exists) {
        return res.status(404).json({ error: 'Goal not found' });
      }

      const goalData = goalDoc.data() as SavingsGoal;
      
      if (goalData.userId !== userId) {
        return res.status(403).json({ error: 'Forbidden' });
      }

      const contribution: GoalContribution = {
        id: `contrib_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        amount,
        date: new Date().toISOString(),
        method: method || 'manual',
        source,
        note
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

      await goalRef.update({
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

      if (!db) {
        return res.status(500).json({ error: 'Database not initialized' });
      }

      const goalRef = db.collection('goals').doc(goalId);
      const goalDoc = await goalRef.get();

      if (!goalDoc.exists) {
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

      await goalRef.update(updateData);

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

      if (!db) {
        return res.status(500).json({ error: 'Database not initialized' });
      }

      const goalRef = db.collection('goals').doc(goalId);
      const goalDoc = await goalRef.get();

      if (!goalDoc.exists) {
        return res.status(404).json({ error: 'Goal not found' });
      }

      const goalData = goalDoc.data() as SavingsGoal;
      
      if (goalData.userId !== userId) {
        return res.status(403).json({ error: 'Forbidden' });
      }

      await goalRef.delete();

      res.json({ success: true });
    } catch (error: any) {
      console.error('Error deleting goal:', error);
      res.status(500).json({ error: 'Failed to delete goal' });
    }
  }
} 