"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const auth_1 = require("../middleware/auth");
const validation_1 = require("../middleware/validation");
const schemas_1 = require("../models/schemas");
const budgets_1 = require("../controllers/budgets");
const router = express_1.default.Router();
// Get all budgets for a user
router.get('/', auth_1.auth, budgets_1.getAllBudgets);
// Get a specific budget
router.get('/:id', auth_1.auth, budgets_1.getBudgetById);
// Create a new budget
router.post('/', auth_1.auth, (0, validation_1.validate)(schemas_1.createBudgetSchema), budgets_1.createBudget);
// Update a budget
router.put('/:id', auth_1.auth, (0, validation_1.validate)(schemas_1.updateBudgetSchema), budgets_1.updateBudget);
// Delete a budget
router.delete('/:id', auth_1.auth, budgets_1.deleteBudget);
exports.default = router;
