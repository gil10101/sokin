"use strict";
/**
 * Goals Controller
 *
 * Handles CRUD operations for savings goals with proper authorization,
 * caching, and error handling.
 *
 * @module controllers/goalsController
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteGoal = exports.updateGoal = exports.addContribution = exports.createGoal = exports.getGoalById = exports.getUserGoals = void 0;
const firestore_1 = require("firebase-admin/firestore");
const firebase_1 = require("../config/firebase");
const errorHandler_1 = require("../middleware/errorHandler");
const logger_1 = __importDefault(require("../utils/logger"));
const cache_1 = __importStar(require("../utils/cache"));
/**
 * Build cache key for goals list
 */
function buildGoalsCacheKey(userId) {
    return `goals:${userId}:list`;
}
/**
 * Build cache key for single goal
 */
function buildGoalCacheKey(goalId) {
    return `goal:${goalId}`;
}
/**
 * Get user's savings goals
 */
const getUserGoals = async (req, res, next) => {
    var _a, _b;
    try {
        const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.uid;
        if (!userId) {
            throw new errorHandler_1.AppError('Unauthorized: User ID missing', 401, true);
        }
        if (!firebase_1.db) {
            throw new errorHandler_1.AppError('Database not initialized', 500, false);
        }
        const cacheKey = buildGoalsCacheKey(userId);
        // Try distributed cache first
        const cachedResult = await cache_1.default.getAsync(cacheKey);
        if (cachedResult) {
            res.json(cachedResult);
            return;
        }
        const goalsRef = firebase_1.db.collection('goals');
        const snapshot = await goalsRef.where('userId', '==', userId).get();
        const goals = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        const result = { success: true, data: goals };
        // Cache the result
        await cache_1.default.setAsync(cacheKey, result, cache_1.CACHE_TTL.LIST_QUERY);
        res.json(result);
    }
    catch (error) {
        if (error instanceof errorHandler_1.AppError) {
            next(error);
            return;
        }
        logger_1.default.error('Error fetching goals', {
            error: error instanceof Error ? error.message : 'Unknown error',
            userId: (_b = req.user) === null || _b === void 0 ? void 0 : _b.uid
        });
        next(new errorHandler_1.AppError('Failed to fetch goals', 500, false));
    }
};
exports.getUserGoals = getUserGoals;
/**
 * Get a specific goal by ID
 */
const getGoalById = async (req, res, next) => {
    var _a, _b;
    try {
        const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.uid;
        const { goalId } = req.params;
        if (!userId) {
            throw new errorHandler_1.AppError('Unauthorized: User ID missing', 401, true);
        }
        if (!firebase_1.db) {
            throw new errorHandler_1.AppError('Database not initialized', 500, false);
        }
        const cacheKey = buildGoalCacheKey(goalId);
        // Try distributed cache first
        const cachedGoal = await cache_1.default.getAsync(cacheKey);
        if (cachedGoal) {
            // Verify ownership from cached data
            if (cachedGoal.data.userId !== userId) {
                throw new errorHandler_1.AppError('Forbidden: Access denied', 403, true);
            }
            res.json(cachedGoal);
            return;
        }
        const goalRef = firebase_1.db.collection('goals').doc(goalId);
        const goalDoc = await goalRef.get();
        if (!goalDoc.exists) {
            throw new errorHandler_1.AppError('Goal not found', 404, true);
        }
        const goalData = goalDoc.data();
        if (goalData.userId !== userId) {
            throw new errorHandler_1.AppError('Forbidden: Access denied', 403, true);
        }
        const goal = { id: goalDoc.id, ...goalData };
        const result = { success: true, data: goal };
        // Cache the result
        await cache_1.default.setAsync(cacheKey, result, cache_1.CACHE_TTL.SINGLE_ITEM);
        res.json(result);
    }
    catch (error) {
        if (error instanceof errorHandler_1.AppError) {
            next(error);
            return;
        }
        logger_1.default.error('Error fetching goal', {
            error: error instanceof Error ? error.message : 'Unknown error',
            goalId: req.params.goalId,
            userId: (_b = req.user) === null || _b === void 0 ? void 0 : _b.uid
        });
        next(new errorHandler_1.AppError('Failed to fetch goal', 500, false));
    }
};
exports.getGoalById = getGoalById;
/**
 * Create new savings goal
 */
const createGoal = async (req, res, next) => {
    var _a, _b;
    try {
        const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.uid;
        if (!userId) {
            throw new errorHandler_1.AppError('Unauthorized: User ID missing', 401, true);
        }
        if (!firebase_1.db) {
            throw new errorHandler_1.AppError('Database not initialized', 500, false);
        }
        // Validate required fields
        const { name, description, targetAmount, targetDate, category, priority, milestones } = req.body;
        if (!name || typeof name !== 'string' || name.trim().length === 0) {
            throw new errorHandler_1.AppError('Name is required and must be a non-empty string', 400, true);
        }
        if (name.length > 100) {
            throw new errorHandler_1.AppError('Name cannot exceed 100 characters', 400, true);
        }
        const numericTargetAmount = Number(targetAmount);
        if (!Number.isFinite(numericTargetAmount) || numericTargetAmount <= 0) {
            throw new errorHandler_1.AppError('Target amount must be a positive number', 400, true);
        }
        // Validate targetDate if provided
        if (targetDate) {
            if (typeof targetDate !== 'string' || isNaN(Date.parse(targetDate))) {
                throw new errorHandler_1.AppError('Target date must be a valid date', 400, true);
            }
        }
        // Validate priority if provided
        const validPriorities = ['low', 'medium', 'high'];
        if (priority && !validPriorities.includes(priority)) {
            throw new errorHandler_1.AppError(`Priority must be one of: ${validPriorities.join(', ')}`, 400, true);
        }
        // Validate milestones if provided
        if (milestones) {
            if (!Array.isArray(milestones)) {
                throw new errorHandler_1.AppError('Milestones must be an array', 400, true);
            }
            for (const milestone of milestones) {
                if (typeof milestone.percentage !== 'number' || milestone.percentage < 0 || milestone.percentage > 100) {
                    throw new errorHandler_1.AppError('Milestone percentage must be a number between 0 and 100', 400, true);
                }
                if (typeof milestone.amount !== 'number' || milestone.amount < 0) {
                    throw new errorHandler_1.AppError('Milestone amount must be a non-negative number', 400, true);
                }
            }
        }
        // Create validated milestones with correct amounts based on validated targetAmount
        const validatedMilestones = milestones || [
            { percentage: 25, amount: numericTargetAmount * 0.25 },
            { percentage: 50, amount: numericTargetAmount * 0.5 },
            { percentage: 75, amount: numericTargetAmount * 0.75 },
            { percentage: 100, amount: numericTargetAmount }
        ];
        const goalData = {
            userId,
            name: name.trim(),
            description: (description === null || description === void 0 ? void 0 : description.trim()) || undefined,
            targetAmount: numericTargetAmount,
            currentAmount: 0,
            targetDate: targetDate || undefined,
            category: (category === null || category === void 0 ? void 0 : category.trim()) || undefined,
            priority: priority || 'medium',
            isCompleted: false,
            createdAt: new Date().toISOString(),
            milestones: validatedMilestones,
            contributions: []
        };
        const docRef = await firebase_1.db.collection('goals').add(goalData);
        const newGoal = { id: docRef.id, ...goalData };
        // Invalidate goals list cache
        await cache_1.default.invalidatePatternAsync(`goals:${userId}:*`);
        res.status(201).json({ success: true, data: newGoal, message: 'Goal created successfully' });
    }
    catch (error) {
        if (error instanceof errorHandler_1.AppError) {
            next(error);
            return;
        }
        logger_1.default.error('Error creating goal', {
            error: error instanceof Error ? error.message : 'Unknown error',
            userId: (_b = req.user) === null || _b === void 0 ? void 0 : _b.uid
        });
        next(new errorHandler_1.AppError('Failed to create goal', 500, false));
    }
};
exports.createGoal = createGoal;
/**
 * Add contribution to goal
 */
const addContribution = async (req, res, next) => {
    var _a, _b;
    try {
        const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.uid;
        const { goalId } = req.params;
        const { amount, method, source, note } = req.body;
        if (!userId) {
            throw new errorHandler_1.AppError('Unauthorized: User ID missing', 401, true);
        }
        if (!firebase_1.db) {
            throw new errorHandler_1.AppError('Database not initialized', 500, false);
        }
        // Validate contribution amount upfront
        if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0) {
            throw new errorHandler_1.AppError('Contribution amount must be a positive number', 400, true);
        }
        const goalRef = firebase_1.db.collection('goals').doc(goalId);
        // Use Firestore transaction to prevent race conditions on concurrent contributions
        const result = await firebase_1.db.runTransaction(async (transaction) => {
            var _a;
            const goalDoc = await transaction.get(goalRef);
            if (!goalDoc.exists) {
                throw new errorHandler_1.AppError('Goal not found', 404, true);
            }
            const goalData = goalDoc.data();
            if (goalData.userId !== userId) {
                throw new errorHandler_1.AppError('Forbidden: Access denied', 403, true);
            }
            const contribution = {
                id: `contrib_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
                amount,
                date: new Date().toISOString(),
                method: method || 'manual',
                source,
                note
            };
            const newCurrentAmount = goalData.currentAmount + amount;
            const isCompleted = newCurrentAmount >= goalData.targetAmount;
            // Update milestones
            const updatedMilestones = (_a = goalData.milestones) === null || _a === void 0 ? void 0 : _a.map(milestone => ({
                ...milestone,
                achievedAt: newCurrentAmount >= milestone.amount && !milestone.achievedAt
                    ? new Date().toISOString()
                    : milestone.achievedAt
            }));
            // Use atomic operations within transaction
            transaction.update(goalRef, {
                currentAmount: firestore_1.FieldValue.increment(amount),
                contributions: firestore_1.FieldValue.arrayUnion(contribution),
                milestones: updatedMilestones,
                isCompleted,
                completedAt: isCompleted && !goalData.completedAt ? new Date().toISOString() : goalData.completedAt,
                updatedAt: new Date().toISOString()
            });
            return { newCurrentAmount, isCompleted };
        });
        // Invalidate caches non-blocking
        Promise.all([
            cache_1.default.invalidatePatternAsync(`goals:${userId}:*`),
            cache_1.default.delAsync(buildGoalCacheKey(goalId))
        ]).catch((err) => {
            logger_1.default.warn('Cache invalidation failed for contribution', {
                goalId, userId, error: err instanceof Error ? err.message : 'Unknown error'
            });
        });
        res.json({
            success: true,
            data: {
                currentAmount: result.newCurrentAmount,
                isCompleted: result.isCompleted
            },
            message: 'Contribution added successfully'
        });
    }
    catch (error) {
        if (error instanceof errorHandler_1.AppError) {
            next(error);
            return;
        }
        logger_1.default.error('Error adding contribution', {
            error: error instanceof Error ? error.message : 'Unknown error',
            goalId: req.params.goalId,
            userId: (_b = req.user) === null || _b === void 0 ? void 0 : _b.uid
        });
        next(new errorHandler_1.AppError('Failed to add contribution', 500, false));
    }
};
exports.addContribution = addContribution;
/**
 * Update goal
 */
const updateGoal = async (req, res, next) => {
    var _a, _b;
    try {
        const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.uid;
        const { goalId } = req.params;
        if (!userId) {
            throw new errorHandler_1.AppError('Unauthorized: User ID missing', 401, true);
        }
        if (!firebase_1.db) {
            throw new errorHandler_1.AppError('Database not initialized', 500, false);
        }
        const goalRef = firebase_1.db.collection('goals').doc(goalId);
        const goalDoc = await goalRef.get();
        if (!goalDoc.exists) {
            throw new errorHandler_1.AppError('Goal not found', 404, true);
        }
        const goalData = goalDoc.data();
        if (goalData.userId !== userId) {
            throw new errorHandler_1.AppError('Forbidden: Access denied', 403, true);
        }
        // Whitelist allowed update fields to prevent overwriting protected fields
        const { name, description, targetAmount, targetDate, category, priority } = req.body;
        const updateData = {
            updatedAt: new Date().toISOString()
        };
        // Validate and assign name
        if (name !== undefined) {
            if (typeof name !== 'string' || name.trim().length === 0) {
                throw new errorHandler_1.AppError('Name must be a non-empty string', 400, true);
            }
            if (name.length > 100) {
                throw new errorHandler_1.AppError('Name cannot exceed 100 characters', 400, true);
            }
            updateData.name = name.trim();
        }
        // Validate and assign description
        if (description !== undefined) {
            if (description !== null && typeof description !== 'string') {
                throw new errorHandler_1.AppError('Description must be a string', 400, true);
            }
            updateData.description = (description === null || description === void 0 ? void 0 : description.trim()) || undefined;
        }
        // Validate and assign targetAmount
        if (targetAmount !== undefined) {
            const numericAmount = Number(targetAmount);
            if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
                throw new errorHandler_1.AppError('Target amount must be a positive number', 400, true);
            }
            updateData.targetAmount = numericAmount;
        }
        // Validate and assign targetDate
        if (targetDate !== undefined) {
            if (typeof targetDate !== 'string' || isNaN(Date.parse(targetDate))) {
                throw new errorHandler_1.AppError('Target date must be a valid date', 400, true);
            }
            updateData.targetDate = targetDate;
        }
        // Validate and assign category
        if (category !== undefined) {
            const validCategories = ['emergency', 'vacation', 'home', 'car', 'education', 'retirement', 'other'];
            const trimmedCategory = typeof category === 'string' ? category.trim() : category;
            if (!validCategories.includes(trimmedCategory)) {
                throw new errorHandler_1.AppError(`Category must be one of: ${validCategories.join(', ')}`, 400, true);
            }
            updateData.category = trimmedCategory;
        }
        // Validate and assign priority
        if (priority !== undefined) {
            const validPriorities = ['low', 'medium', 'high'];
            if (!validPriorities.includes(priority)) {
                throw new errorHandler_1.AppError(`Priority must be one of: ${validPriorities.join(', ')}`, 400, true);
            }
            updateData.priority = priority;
        }
        await goalRef.update(updateData);
        // Invalidate caches
        await Promise.all([
            cache_1.default.invalidatePatternAsync(`goals:${userId}:*`),
            cache_1.default.delAsync(buildGoalCacheKey(goalId))
        ]);
        res.json({ success: true, message: 'Goal updated successfully' });
    }
    catch (error) {
        if (error instanceof errorHandler_1.AppError) {
            next(error);
            return;
        }
        logger_1.default.error('Error updating goal', {
            error: error instanceof Error ? error.message : 'Unknown error',
            goalId: req.params.goalId,
            userId: (_b = req.user) === null || _b === void 0 ? void 0 : _b.uid
        });
        next(new errorHandler_1.AppError('Failed to update goal', 500, false));
    }
};
exports.updateGoal = updateGoal;
/**
 * Delete goal
 */
const deleteGoal = async (req, res, next) => {
    var _a, _b;
    try {
        const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.uid;
        const { goalId } = req.params;
        if (!userId) {
            throw new errorHandler_1.AppError('Unauthorized: User ID missing', 401, true);
        }
        if (!firebase_1.db) {
            throw new errorHandler_1.AppError('Database not initialized', 500, false);
        }
        const goalRef = firebase_1.db.collection('goals').doc(goalId);
        const goalDoc = await goalRef.get();
        if (!goalDoc.exists) {
            throw new errorHandler_1.AppError('Goal not found', 404, true);
        }
        const goalData = goalDoc.data();
        if (goalData.userId !== userId) {
            throw new errorHandler_1.AppError('Forbidden: Access denied', 403, true);
        }
        await goalRef.delete();
        // Invalidate caches
        await Promise.all([
            cache_1.default.invalidatePatternAsync(`goals:${userId}:*`),
            cache_1.default.delAsync(buildGoalCacheKey(goalId))
        ]);
        res.json({ success: true, message: 'Goal deleted successfully' });
    }
    catch (error) {
        if (error instanceof errorHandler_1.AppError) {
            next(error);
            return;
        }
        logger_1.default.error('Error deleting goal', {
            error: error instanceof Error ? error.message : 'Unknown error',
            goalId: req.params.goalId,
            userId: (_b = req.user) === null || _b === void 0 ? void 0 : _b.uid
        });
        next(new errorHandler_1.AppError('Failed to delete goal', 500, false));
    }
};
exports.deleteGoal = deleteGoal;
