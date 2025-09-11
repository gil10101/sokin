"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GoalsController = void 0;
const firebase_1 = require("../config/firebase");
const logger_1 = __importDefault(require("../utils/logger"));
class GoalsController {
    // Get user's savings goals
    static async getUserGoals(req, res) {
        var _a, _b;
        try {
            const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.uid;
            if (!userId) {
                return res.status(401).json({ error: 'Unauthorized' });
            }
            if (!firebase_1.db) {
                return res.status(500).json({ error: 'Database not initialized' });
            }
            const goalsRef = firebase_1.db.collection('goals');
            const snapshot = await goalsRef.where('userId', '==', userId).get();
            const goals = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            res.json({ goals });
        }
        catch (error) {
            logger_1.default.error('Error fetching goals', { error: error instanceof Error ? error.message : 'Unknown error', userId: (_b = req.user) === null || _b === void 0 ? void 0 : _b.uid });
            res.status(500).json({ error: 'Failed to fetch goals' });
        }
    }
    // Create new savings goal
    static async createGoal(req, res) {
        var _a, _b;
        try {
            const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.uid;
            if (!userId) {
                return res.status(401).json({ error: 'Unauthorized' });
            }
            if (!firebase_1.db) {
                return res.status(500).json({ error: 'Database not initialized' });
            }
            const goalData = {
                userId,
                name: req.body.name,
                description: req.body.description,
                targetAmount: req.body.targetAmount,
                currentAmount: 0,
                targetDate: req.body.targetDate,
                category: req.body.category,
                priority: req.body.priority,
                isCompleted: false,
                createdAt: new Date().toISOString(),
                milestones: req.body.milestones || [
                    { percentage: 25, amount: req.body.targetAmount * 0.25 },
                    { percentage: 50, amount: req.body.targetAmount * 0.5 },
                    { percentage: 75, amount: req.body.targetAmount * 0.75 },
                    { percentage: 100, amount: req.body.targetAmount }
                ],
                contributions: []
            };
            const docRef = await firebase_1.db.collection('goals').add(goalData);
            const newGoal = { id: docRef.id, ...goalData };
            res.status(201).json({ goal: newGoal });
        }
        catch (error) {
            logger_1.default.error('Error creating goal', { error: error instanceof Error ? error.message : 'Unknown error', userId: (_b = req.user) === null || _b === void 0 ? void 0 : _b.uid });
            res.status(500).json({ error: 'Failed to create goal' });
        }
    }
    // Add contribution to goal
    static async addContribution(req, res) {
        var _a, _b, _c;
        try {
            const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.uid;
            const { goalId } = req.params;
            const { amount, method, source, note } = req.body;
            if (!userId) {
                return res.status(401).json({ error: 'Unauthorized' });
            }
            if (!firebase_1.db) {
                return res.status(500).json({ error: 'Database not initialized' });
            }
            const goalRef = firebase_1.db.collection('goals').doc(goalId);
            const goalDoc = await goalRef.get();
            if (!goalDoc.exists) {
                return res.status(404).json({ error: 'Goal not found' });
            }
            const goalData = goalDoc.data();
            if (goalData.userId !== userId) {
                return res.status(403).json({ error: 'Forbidden' });
            }
            const contribution = {
                id: `contrib_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                amount,
                date: new Date().toISOString(),
                method: method || 'manual',
                source,
                note
            };
            const newCurrentAmount = goalData.currentAmount + amount;
            const isCompleted = newCurrentAmount >= goalData.targetAmount;
            // Update milestones
            const updatedMilestones = (_b = goalData.milestones) === null || _b === void 0 ? void 0 : _b.map(milestone => ({
                ...milestone,
                achievedAt: newCurrentAmount >= milestone.amount && !milestone.achievedAt
                    ? new Date().toISOString()
                    : milestone.achievedAt
            }));
            await goalRef.update({
                currentAmount: newCurrentAmount,
                contributions: [...(goalData.contributions || []), contribution],
                milestones: updatedMilestones,
                isCompleted,
                completedAt: isCompleted ? new Date().toISOString() : goalData.completedAt,
                updatedAt: new Date().toISOString()
            });
            res.json({
                success: true,
                currentAmount: newCurrentAmount,
                isCompleted
            });
        }
        catch (error) {
            logger_1.default.error('Error adding contribution', { error: error instanceof Error ? error.message : 'Unknown error', goalId: req.params.goalId, userId: (_c = req.user) === null || _c === void 0 ? void 0 : _c.uid });
            res.status(500).json({ error: 'Failed to add contribution' });
        }
    }
    // Update goal
    static async updateGoal(req, res) {
        var _a, _b;
        try {
            const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.uid;
            const { goalId } = req.params;
            if (!userId) {
                return res.status(401).json({ error: 'Unauthorized' });
            }
            if (!firebase_1.db) {
                return res.status(500).json({ error: 'Database not initialized' });
            }
            const goalRef = firebase_1.db.collection('goals').doc(goalId);
            const goalDoc = await goalRef.get();
            if (!goalDoc.exists) {
                return res.status(404).json({ error: 'Goal not found' });
            }
            const goalData = goalDoc.data();
            if (goalData.userId !== userId) {
                return res.status(403).json({ error: 'Forbidden' });
            }
            const updateData = {
                ...req.body,
                updatedAt: new Date().toISOString()
            };
            await goalRef.update(updateData);
            res.json({ success: true });
        }
        catch (error) {
            logger_1.default.error('Error updating goal', { error: error instanceof Error ? error.message : 'Unknown error', goalId: req.params.goalId, userId: (_b = req.user) === null || _b === void 0 ? void 0 : _b.uid });
            res.status(500).json({ error: 'Failed to update goal' });
        }
    }
    // Delete goal
    static async deleteGoal(req, res) {
        var _a, _b;
        try {
            const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.uid;
            const { goalId } = req.params;
            if (!userId) {
                return res.status(401).json({ error: 'Unauthorized' });
            }
            if (!firebase_1.db) {
                return res.status(500).json({ error: 'Database not initialized' });
            }
            const goalRef = firebase_1.db.collection('goals').doc(goalId);
            const goalDoc = await goalRef.get();
            if (!goalDoc.exists) {
                return res.status(404).json({ error: 'Goal not found' });
            }
            const goalData = goalDoc.data();
            if (goalData.userId !== userId) {
                return res.status(403).json({ error: 'Forbidden' });
            }
            await goalRef.delete();
            res.json({ success: true });
        }
        catch (error) {
            logger_1.default.error('Error deleting goal', { error: error instanceof Error ? error.message : 'Unknown error', goalId: req.params.goalId, userId: (_b = req.user) === null || _b === void 0 ? void 0 : _b.uid });
            res.status(500).json({ error: 'Failed to delete goal' });
        }
    }
}
exports.GoalsController = GoalsController;
