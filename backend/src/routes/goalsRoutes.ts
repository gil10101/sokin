import { Router } from 'express';
import { GoalsController } from '../controllers/goalsController';
import { auth } from '../middleware/auth';

const router = Router();

// Get user's savings goals
router.get('/', auth, GoalsController.getUserGoals);

// Create new savings goal
router.post('/', auth, GoalsController.createGoal);

// Add contribution to goal
router.post('/:goalId/contribute', auth, GoalsController.addContribution);

// Update goal
router.put('/:goalId', auth, GoalsController.updateGoal);

// Delete goal
router.delete('/:goalId', auth, GoalsController.deleteGoal);

export default router; 