import { Router } from 'express';
import { BillRemindersController } from '../controllers/billRemindersController';
import { auth } from '../middleware/auth';

const router = Router();

// Get user's bill reminders
router.get('/', auth, BillRemindersController.getUserBillReminders);

// Create new bill reminder
router.post('/', auth, BillRemindersController.createBillReminder);

// Mark bill as paid
router.post('/:billId/pay', auth, BillRemindersController.markBillAsPaid);

// Update bill reminder
router.put('/:billId', auth, BillRemindersController.updateBillReminder);

// Delete bill reminder
router.delete('/:billId', auth, BillRemindersController.deleteBillReminder);

export default router; 