"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const goalsController_1 = require("../controllers/goalsController");
const auth_1 = require("../middleware/auth");
const rateLimiter_1 = require("../middleware/rateLimiter");
const router = (0, express_1.Router)();
// Rate limiting for goals API calls (more lenient than other endpoints)
const goalsRateLimit = (0, rateLimiter_1.rateLimiter)(200, 15 * 60 * 1000); // 200 requests per 15 minutes
// Get user's savings goals
router.get('/', goalsRateLimit, auth_1.auth, goalsController_1.GoalsController.getUserGoals);
// Create new savings goal
router.post('/', goalsRateLimit, auth_1.auth, goalsController_1.GoalsController.createGoal);
// Add contribution to goal
router.post('/:goalId/contribute', goalsRateLimit, auth_1.auth, goalsController_1.GoalsController.addContribution);
// Update goal
router.put('/:goalId', goalsRateLimit, auth_1.auth, goalsController_1.GoalsController.updateGoal);
// Delete goal
router.delete('/:goalId', goalsRateLimit, auth_1.auth, goalsController_1.GoalsController.deleteGoal);
exports.default = router;
