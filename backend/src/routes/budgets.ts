import express from 'express';
import { auth } from '../middleware/auth';
import { validate } from '../middleware/validation';
import { createBudgetSchema, updateBudgetSchema } from '../models/schemas';
import { 
  getAllBudgets, 
  getBudgetById, 
  createBudget, 
  updateBudget, 
  deleteBudget 
} from '../controllers/budgets';

const router = express.Router();

// Get all budgets for a user
router.get('/', auth, getAllBudgets);

// Get a specific budget
router.get('/:id', auth, getBudgetById);

// Create a new budget
router.post('/', auth, validate(createBudgetSchema), createBudget);

// Update a budget
router.put('/:id', auth, validate(updateBudgetSchema), updateBudget);

// Delete a budget
router.delete('/:id', auth, deleteBudget);

export default router; 