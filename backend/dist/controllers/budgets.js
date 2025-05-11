"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteBudget = exports.updateBudget = exports.createBudget = exports.getBudgetById = exports.getAllBudgets = void 0;
const firebase_1 = require("../config/firebase");
const errorHandler_1 = require("../middleware/errorHandler");
const logger_1 = __importDefault(require("../utils/logger"));
const cache_1 = __importDefault(require("../utils/cache"));
// Get all budgets for a user
const getAllBudgets = async (req, res) => {
    try {
        if (!req.user || !req.user.uid) {
            throw new errorHandler_1.AppError('Unauthorized: User ID missing', 401, true);
        }
        const userId = req.user.uid;
        const cacheKey = `budgets_${userId}`;
        // Try to get from cache first
        const cachedBudgets = cache_1.default.get(cacheKey);
        if (cachedBudgets) {
            res.status(200).json({ data: cachedBudgets });
            return;
        }
        // Get budgets from database
        const budgetsRef = firebase_1.db.collection('budgets');
        const budgetsSnapshot = await budgetsRef.where('userId', '==', userId).get();
        const budgets = budgetsSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        // Cache budgets data (30 seconds)
        cache_1.default.set(cacheKey, budgets, 30);
        res.status(200).json({ data: budgets });
    }
    catch (error) {
        if (error instanceof errorHandler_1.AppError) {
            throw error;
        }
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        logger_1.default.error(`Error in getAllBudgets: ${errorMessage}`);
        res.status(500).json({ error: 'Failed to fetch budgets' });
    }
};
exports.getAllBudgets = getAllBudgets;
// Get a specific budget
const getBudgetById = async (req, res) => {
    try {
        if (!req.user || !req.user.uid) {
            throw new errorHandler_1.AppError('Unauthorized: User ID missing', 401, true);
        }
        const userId = req.user.uid;
        const budgetId = req.params.id;
        // Get budget from database
        const budgetDoc = await firebase_1.db.collection('budgets').doc(budgetId).get();
        if (!budgetDoc.exists) {
            throw new errorHandler_1.AppError('Budget not found', 404, true);
        }
        const budgetData = budgetDoc.data();
        // Verify the budget belongs to the requesting user
        if (budgetData.userId !== userId) {
            throw new errorHandler_1.AppError('Forbidden: You do not have access to this budget', 403, true);
        }
        res.status(200).json({
            data: {
                id: budgetDoc.id,
                ...budgetData
            }
        });
    }
    catch (error) {
        if (error instanceof errorHandler_1.AppError) {
            res.status(error.statusCode).json({ error: error.message });
            return;
        }
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        logger_1.default.error(`Error in getBudgetById: ${errorMessage}`);
        res.status(500).json({ error: 'Failed to fetch budget' });
    }
};
exports.getBudgetById = getBudgetById;
// Create a new budget
const createBudget = async (req, res) => {
    try {
        if (!req.user || !req.user.uid) {
            throw new errorHandler_1.AppError('Unauthorized: User ID missing', 401, true);
        }
        const { name, amount, period, categories, startDate, endDate } = req.body;
        const budgetData = {
            userId: req.user.uid,
            name,
            amount: Number(amount),
            period,
            categories: categories || [],
            startDate,
            endDate: endDate || null,
            createdAt: new Date().toISOString(),
        };
        const budgetRef = await firebase_1.db.collection('budgets').add(budgetData);
        // Clear cache
        cache_1.default.del(`budgets_${req.user.uid}`);
        res.status(201).json({
            data: {
                id: budgetRef.id,
                ...budgetData
            },
            message: 'Budget created successfully'
        });
    }
    catch (error) {
        if (error instanceof errorHandler_1.AppError) {
            res.status(error.statusCode).json({ error: error.message });
            return;
        }
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        logger_1.default.error(`Error in createBudget: ${errorMessage}`);
        res.status(500).json({ error: 'Failed to create budget' });
    }
};
exports.createBudget = createBudget;
// Update a budget
const updateBudget = async (req, res) => {
    try {
        if (!req.user || !req.user.uid) {
            throw new errorHandler_1.AppError('Unauthorized: User ID missing', 401, true);
        }
        const userId = req.user.uid;
        const budgetId = req.params.id;
        // Get budget document
        const budgetDoc = await firebase_1.db.collection('budgets').doc(budgetId).get();
        if (!budgetDoc.exists) {
            throw new errorHandler_1.AppError('Budget not found', 404, true);
        }
        const budgetData = budgetDoc.data();
        // Verify the budget belongs to the requesting user
        if (budgetData.userId !== userId) {
            throw new errorHandler_1.AppError('Forbidden: You do not have access to this budget', 403, true);
        }
        // Build update object with only provided fields
        const { name, amount, period, categories, startDate, endDate } = req.body;
        const updateData = {};
        if (name !== undefined)
            updateData.name = name;
        if (amount !== undefined)
            updateData.amount = Number(amount);
        if (period !== undefined)
            updateData.period = period;
        if (categories !== undefined)
            updateData.categories = categories;
        if (startDate !== undefined)
            updateData.startDate = startDate;
        if (endDate !== undefined)
            updateData.endDate = endDate;
        updateData.updatedAt = new Date().toISOString();
        await firebase_1.db.collection('budgets').doc(budgetId).update(updateData);
        // Clear cache
        cache_1.default.del(`budgets_${userId}`);
        res.status(200).json({
            data: {
                id: budgetId,
                ...budgetData,
                ...updateData
            },
            message: 'Budget updated successfully'
        });
    }
    catch (error) {
        if (error instanceof errorHandler_1.AppError) {
            res.status(error.statusCode).json({ error: error.message });
            return;
        }
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        logger_1.default.error(`Error in updateBudget: ${errorMessage}`);
        res.status(500).json({ error: 'Failed to update budget' });
    }
};
exports.updateBudget = updateBudget;
// Delete a budget
const deleteBudget = async (req, res) => {
    try {
        if (!req.user || !req.user.uid) {
            throw new errorHandler_1.AppError('Unauthorized: User ID missing', 401, true);
        }
        const userId = req.user.uid;
        const budgetId = req.params.id;
        // Get budget document
        const budgetDoc = await firebase_1.db.collection('budgets').doc(budgetId).get();
        if (!budgetDoc.exists) {
            throw new errorHandler_1.AppError('Budget not found', 404, true);
        }
        const budgetData = budgetDoc.data();
        // Verify the budget belongs to the requesting user
        if (budgetData.userId !== userId) {
            throw new errorHandler_1.AppError('Forbidden: You do not have access to this budget', 403, true);
        }
        await firebase_1.db.collection('budgets').doc(budgetId).delete();
        // Clear cache
        cache_1.default.del(`budgets_${userId}`);
        res.status(200).json({
            message: 'Budget deleted successfully'
        });
    }
    catch (error) {
        if (error instanceof errorHandler_1.AppError) {
            res.status(error.statusCode).json({ error: error.message });
            return;
        }
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        logger_1.default.error(`Error in deleteBudget: ${errorMessage}`);
        res.status(500).json({ error: 'Failed to delete budget' });
    }
};
exports.deleteBudget = deleteBudget;
