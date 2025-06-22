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

      if (!db) {
        return res.status(500).json({ error: 'Database not initialized' });
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

      if (!db) {
        return res.status(500).json({ error: 'Database not initialized' });
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

      const docRef = await db.collection('billReminders').add(billData);
      const newBill = { id: docRef.id, ...billData };

      res.status(201).json({ bill: newBill });
    } catch (error: any) {
      console.error('Error creating bill reminder:', error);
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
        return res.status(500).json({ error: 'Database not initialized' });
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
        return res.status(500).json({ error: 'Database not initialized' });
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
        return res.status(500).json({ error: 'Database not initialized' });
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