import { Request, Response } from 'express';
import { db } from '../config/firebase';

interface BillReminder {
  id?: string;
  userId: string;
  name: string;
  amount: number;
  dueDate: string;
  frequency: 'weekly' | 'monthly' | 'quarterly' | 'yearly' | 'one-time';
  category: string;
  description?: string;
  isPaid: boolean;
  paidDate?: string;
  reminderDays: number[];
  autoPayEnabled: boolean;
  linkedAccount?: string;
  createdAt: string;
  updatedAt?: string;
}

export class BillRemindersController {
  
  // Get user's bill reminders
  static async getUserBillReminders(req: Request, res: Response) {
    try {
      const userId = req.user?.uid;
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      // Development mode: Return mock data if database not available
      if (!db || process.env.NODE_ENV === 'development') {
        const mockBills = [
          {
            id: 'bill_1',
            userId,
            name: 'Electric Bill',
            amount: 120.50,
            dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
            frequency: 'monthly' as const,
            category: 'utilities',
            description: 'Monthly electricity payment',
            isPaid: false,
            reminderDays: [7, 3, 1],
            autoPayEnabled: false,
            createdAt: new Date().toISOString()
          },
          {
            id: 'bill_2',
            userId,
            name: 'Internet Bill',
            amount: 79.99,
            dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
            frequency: 'monthly' as const,
            category: 'utilities',
            description: 'Monthly internet service',
            isPaid: false,
            reminderDays: [7, 3, 1],
            autoPayEnabled: true,
            createdAt: new Date().toISOString()
          },
          {
            id: 'bill_3',
            userId,
            name: 'Rent',
            amount: 1500.00,
            dueDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString(),
            frequency: 'monthly' as const,
            category: 'housing',
            description: 'Monthly rent payment',
            isPaid: false,
            reminderDays: [7, 3, 1],
            autoPayEnabled: false,
            createdAt: new Date().toISOString()
          }
        ];
        
        console.log('Returning mock bill reminders for development');
        return res.json({ bills: mockBills });
      }

      const billsRef = db.collection('billReminders');
      const snapshot = await billsRef.where('userId', '==', userId).get();
      
      const bills = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      res.json({ bills });
    } catch (error: any) {
      console.error('Error fetching bill reminders:', error);
      
      // Fallback to mock data if database fails
      if (process.env.NODE_ENV === 'development') {
        const userId = req.user?.uid || 'dev-user';
        const mockBills = [
          {
            id: 'bill_1',
            userId,
            name: 'Electric Bill',
            amount: 120.50,
            dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
            frequency: 'monthly' as const,
            category: 'utilities',
            description: 'Monthly electricity payment',
            isPaid: false,
            reminderDays: [7, 3, 1],
            autoPayEnabled: false,
            createdAt: new Date().toISOString()
          }
        ];
        
        console.log('Database error - returning fallback mock data');
        return res.json({ bills: mockBills });
      }
      
      res.status(500).json({ error: 'Failed to fetch bill reminders' });
    }
  }

  // Create new bill reminder
  static async createBillReminder(req: Request, res: Response) {
    try {
      const userId = req.user?.uid;
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const billData: Omit<BillReminder, 'id'> = {
        userId,
        name: req.body.name,
        amount: req.body.amount,
        dueDate: req.body.dueDate,
        frequency: req.body.frequency,
        category: req.body.category,
        description: req.body.description,
        isPaid: false,
        reminderDays: req.body.reminderDays || [7, 3, 1],
        autoPayEnabled: req.body.autoPayEnabled || false,
        linkedAccount: req.body.linkedAccount,
        createdAt: new Date().toISOString()
      };

      // Development mode: Return mock success
      if (!db || process.env.NODE_ENV === 'development') {
        const newBill = { id: 'bill_' + Date.now(), ...billData };
        console.log('Development mode: Mock bill reminder created');
        return res.status(201).json({ bill: newBill });
      }

      const docRef = await db.collection('billReminders').add(billData);
      const newBill = { id: docRef.id, ...billData };

      res.status(201).json({ bill: newBill });
    } catch (error: any) {
      console.error('Error creating bill reminder:', error);
      
      // Fallback to mock success in development
      if (process.env.NODE_ENV === 'development') {
        const userId = req.user?.uid || 'dev-user';
        const billData = {
          id: 'bill_' + Date.now(),
          userId,
          name: req.body.name || 'New Bill',
          amount: req.body.amount || 0,
          dueDate: req.body.dueDate || new Date().toISOString(),
          frequency: req.body.frequency || 'monthly',
          category: req.body.category || 'other',
          description: req.body.description,
          isPaid: false,
          reminderDays: [7, 3, 1],
          autoPayEnabled: false,
          createdAt: new Date().toISOString()
        };
        
        console.log('Database error - returning mock bill creation success');
        return res.status(201).json({ bill: billData });
      }
      
      res.status(500).json({ error: 'Failed to create bill reminder' });
    }
  }

  // Mark bill as paid
  static async markBillAsPaid(req: Request, res: Response) {
    try {
      const userId = req.user?.uid;
      const { billId } = req.params;
      const { paidDate } = req.body;

      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      if (!db) {
        throw new Error('Database not initialized');
      }

      const billRef = db.collection('billReminders').doc(billId);
      const billDoc = await billRef.get();

      if (!billDoc.exists) {
        return res.status(404).json({ error: 'Bill reminder not found' });
      }

      const billData = billDoc.data() as BillReminder;
      
      if (billData.userId !== userId) {
        return res.status(403).json({ error: 'Forbidden' });
      }

      await billRef.update({
        isPaid: true,
        paidDate: paidDate || new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      res.json({ success: true });
    } catch (error: any) {
      console.error('Error marking bill as paid:', error);
      res.status(500).json({ error: 'Failed to mark bill as paid' });
    }
  }

  // Update bill reminder
  static async updateBillReminder(req: Request, res: Response) {
    try {
      const userId = req.user?.uid;
      const { billId } = req.params;

      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      if (!db) {
        throw new Error('Database not initialized');
      }

      const billRef = db.collection('billReminders').doc(billId);
      const billDoc = await billRef.get();

      if (!billDoc.exists) {
        return res.status(404).json({ error: 'Bill reminder not found' });
      }

      const billData = billDoc.data() as BillReminder;
      
      if (billData.userId !== userId) {
        return res.status(403).json({ error: 'Forbidden' });
      }

      const updateData = {
        ...req.body,
        updatedAt: new Date().toISOString()
      };

      await billRef.update(updateData);

      res.json({ success: true });
    } catch (error: any) {
      console.error('Error updating bill reminder:', error);
      res.status(500).json({ error: 'Failed to update bill reminder' });
    }
  }

  // Delete bill reminder
  static async deleteBillReminder(req: Request, res: Response) {
    try {
      const userId = req.user?.uid;
      const { billId } = req.params;

      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      if (!db) {
        throw new Error('Database not initialized');
      }

      const billRef = db.collection('billReminders').doc(billId);
      const billDoc = await billRef.get();

      if (!billDoc.exists) {
        return res.status(404).json({ error: 'Bill reminder not found' });
      }

      const billData = billDoc.data() as BillReminder;
      
      if (billData.userId !== userId) {
        return res.status(403).json({ error: 'Forbidden' });
      }

      await billRef.delete();

      res.json({ success: true });
    } catch (error: any) {
      console.error('Error deleting bill reminder:', error);
      res.status(500).json({ error: 'Failed to delete bill reminder' });
    }
  }
} 