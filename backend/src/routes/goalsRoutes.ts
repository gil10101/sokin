import { Router } from 'express';
import { GoalsController } from '../controllers/goalsController';
import { auth } from '../middleware/auth';
import { rateLimiter } from '../middleware/rateLimiter';

const router = Router();

// Rate limiting for goals API calls (more lenient than other endpoints)
const goalsRateLimit = rateLimiter(200, 15 * 60 * 1000); // 200 requests per 15 minutes

// Get user's savings goals
router.get('/', goalsRateLimit, auth, GoalsController.getUserGoals);

// Create new savings goal
router.post('/', goalsRateLimit, auth, GoalsController.createGoal);

// Add contribution to goal
router.post('/:goalId/contribute', goalsRateLimit, auth, GoalsController.addContribution);

// Update goal
router.put('/:goalId', goalsRateLimit, auth, GoalsController.updateGoal);

// Delete goal
router.delete('/:goalId', goalsRateLimit, auth, GoalsController.deleteGoal);

export default router; 