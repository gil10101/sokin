"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const goalsController_1 = require("../controllers/goalsController");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
// Get user's savings goals
router.get('/', auth_1.auth, goalsController_1.GoalsController.getUserGoals);
// Create new savings goal
router.post('/', auth_1.auth, goalsController_1.GoalsController.createGoal);
// Add contribution to goal
router.post('/:goalId/contribute', auth_1.auth, goalsController_1.GoalsController.addContribution);
// Update goal
router.put('/:goalId', auth_1.auth, goalsController_1.GoalsController.updateGoal);
// Delete goal
router.delete('/:goalId', auth_1.auth, goalsController_1.GoalsController.deleteGoal);
exports.default = router;
