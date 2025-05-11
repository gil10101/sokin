"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const auth_1 = require("../middleware/auth");
const validation_1 = require("../middleware/validation");
const schemas_1 = require("../models/schemas");
const expenses_1 = require("../controllers/expenses");
const router = express_1.default.Router();
// Get all expenses for a user
router.get('/', auth_1.auth, expenses_1.getAllExpenses);
// Get a specific expense
router.get('/:id', auth_1.auth, expenses_1.getExpenseById);
// Create a new expense
router.post('/', auth_1.auth, (0, validation_1.validate)(schemas_1.createExpenseSchema), expenses_1.createExpense);
// Update an expense
router.put('/:id', auth_1.auth, (0, validation_1.validate)(schemas_1.updateExpenseSchema), expenses_1.updateExpense);
// Delete an expense
router.delete('/:id', auth_1.auth, expenses_1.deleteExpense);
exports.default = router;
