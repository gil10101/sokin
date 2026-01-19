"use strict";
/**
 * Bill Reminders Controller
 *
 * Handles CRUD operations for bill reminders with proper authorization,
 * caching, and error handling.
 *
 * @module controllers/billRemindersController
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
exports.deleteBillReminder = exports.updateBillReminder = exports.markBillAsPaid = exports.createBillReminder = exports.getBillReminderById = exports.getUserBillReminders = void 0;
const firebase_1 = require("../config/firebase");
const errorHandler_1 = require("../middleware/errorHandler");
const logger_1 = __importDefault(require("../utils/logger"));
const cache_1 = __importStar(require("../utils/cache"));
/**
 * Build cache key for bill reminders list
 */
function buildBillsCacheKey(userId) {
    return `bills:${userId}:list`;
}
/**
 * Build cache key for single bill reminder
 */
function buildBillCacheKey(billId) {
    return `bill:${billId}`;
}
/**
 * Get user's bill reminders
 */
const getUserBillReminders = async (req, res, next) => {
    var _a, _b;
    try {
        const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.uid;
        if (!userId) {
            throw new errorHandler_1.AppError('Unauthorized: User ID missing', 401, true);
        }
        if (!firebase_1.db) {
            throw new errorHandler_1.AppError('Database not initialized', 500, false);
        }
        const cacheKey = buildBillsCacheKey(userId);
        // Try distributed cache first
        const cachedResult = await cache_1.default.getAsync(cacheKey);
        if (cachedResult) {
            res.json(cachedResult);
            return;
        }
        const billsRef = firebase_1.db.collection('billReminders');
        const snapshot = await billsRef.where('userId', '==', userId).get();
        const bills = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        const result = { success: true, data: bills };
        // Cache the result
        await cache_1.default.setAsync(cacheKey, result, cache_1.CACHE_TTL.LIST_QUERY);
        res.json(result);
    }
    catch (error) {
        if (error instanceof errorHandler_1.AppError) {
            next(error);
            return;
        }
        logger_1.default.error('Error fetching bill reminders', {
            error: error instanceof Error ? error.message : 'Unknown error',
            userId: (_b = req.user) === null || _b === void 0 ? void 0 : _b.uid
        });
        next(new errorHandler_1.AppError('Failed to fetch bill reminders', 500, false));
    }
};
exports.getUserBillReminders = getUserBillReminders;
/**
 * Get a specific bill reminder by ID
 */
const getBillReminderById = async (req, res, next) => {
    var _a, _b;
    try {
        const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.uid;
        const { billId } = req.params;
        if (!userId) {
            throw new errorHandler_1.AppError('Unauthorized: User ID missing', 401, true);
        }
        if (!firebase_1.db) {
            throw new errorHandler_1.AppError('Database not initialized', 500, false);
        }
        const cacheKey = buildBillCacheKey(billId);
        // Try distributed cache first
        const cachedBill = await cache_1.default.getAsync(cacheKey);
        if (cachedBill) {
            // Verify ownership from cached data
            if (cachedBill.data.userId !== userId) {
                throw new errorHandler_1.AppError('Forbidden: Access denied', 403, true);
            }
            res.json(cachedBill);
            return;
        }
        const billRef = firebase_1.db.collection('billReminders').doc(billId);
        const billDoc = await billRef.get();
        if (!billDoc.exists) {
            throw new errorHandler_1.AppError('Bill reminder not found', 404, true);
        }
        const billData = billDoc.data();
        if (billData.userId !== userId) {
            throw new errorHandler_1.AppError('Forbidden: Access denied', 403, true);
        }
        const bill = { id: billDoc.id, ...billData };
        const result = { success: true, data: bill };
        // Cache the result
        await cache_1.default.setAsync(cacheKey, result, cache_1.CACHE_TTL.SINGLE_ITEM);
        res.json(result);
    }
    catch (error) {
        if (error instanceof errorHandler_1.AppError) {
            next(error);
            return;
        }
        logger_1.default.error('Error fetching bill reminder', {
            error: error instanceof Error ? error.message : 'Unknown error',
            billId: req.params.billId,
            userId: (_b = req.user) === null || _b === void 0 ? void 0 : _b.uid
        });
        next(new errorHandler_1.AppError('Failed to fetch bill reminder', 500, false));
    }
};
exports.getBillReminderById = getBillReminderById;
/**
 * Create new bill reminder
 */
const createBillReminder = async (req, res, next) => {
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
        const { name, amount, dueDate, frequency, category, description, reminderDays, autoPayEnabled, linkedAccount } = req.body;
        if (!name || typeof name !== 'string' || name.trim().length === 0) {
            throw new errorHandler_1.AppError('Name is required and must be a non-empty string', 400, true);
        }
        if (name.length > 100) {
            throw new errorHandler_1.AppError('Name cannot exceed 100 characters', 400, true);
        }
        const numericAmount = Number(amount);
        if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
            throw new errorHandler_1.AppError('Amount must be a positive number', 400, true);
        }
        if (!dueDate || typeof dueDate !== 'string') {
            throw new errorHandler_1.AppError('Due date is required', 400, true);
        }
        // Validate ISO date format
        if (isNaN(Date.parse(dueDate))) {
            throw new errorHandler_1.AppError('Due date must be a valid date', 400, true);
        }
        const validFrequencies = ['weekly', 'monthly', 'quarterly', 'yearly', 'one-time'];
        if (!frequency || !validFrequencies.includes(frequency)) {
            throw new errorHandler_1.AppError(`Frequency must be one of: ${validFrequencies.join(', ')}`, 400, true);
        }
        if (!category || typeof category !== 'string' || category.trim().length === 0) {
            throw new errorHandler_1.AppError('Category is required', 400, true);
        }
        // Validate reminderDays if provided
        const validReminderDays = reminderDays || [7, 3, 1];
        if (!Array.isArray(validReminderDays) || validReminderDays.some((d) => typeof d !== 'number' || d < 0 || d > 365)) {
            throw new errorHandler_1.AppError('Reminder days must be an array of numbers between 0 and 365', 400, true);
        }
        // Validate autoPayEnabled if provided
        if (autoPayEnabled !== undefined && typeof autoPayEnabled !== 'boolean') {
            throw new errorHandler_1.AppError('Auto pay enabled must be a boolean', 400, true);
        }
        const billData = {
            userId,
            name: name.trim(),
            amount: numericAmount,
            dueDate,
            frequency,
            category: category.trim(),
            description: (description === null || description === void 0 ? void 0 : description.trim()) || undefined,
            isPaid: false,
            reminderDays: validReminderDays,
            autoPayEnabled: autoPayEnabled || false,
            linkedAccount: (linkedAccount === null || linkedAccount === void 0 ? void 0 : linkedAccount.trim()) || undefined,
            createdAt: new Date().toISOString()
        };
        const docRef = await firebase_1.db.collection('billReminders').add(billData);
        const newBill = { id: docRef.id, ...billData };
        // Invalidate bills list cache
        await cache_1.default.invalidatePatternAsync(`bills:${userId}:*`);
        res.status(201).json({ success: true, data: newBill, message: 'Bill reminder created successfully' });
    }
    catch (error) {
        if (error instanceof errorHandler_1.AppError) {
            next(error);
            return;
        }
        logger_1.default.error('Error creating bill reminder', {
            error: error instanceof Error ? error.message : 'Unknown error',
            userId: (_b = req.user) === null || _b === void 0 ? void 0 : _b.uid
        });
        next(new errorHandler_1.AppError('Failed to create bill reminder', 500, false));
    }
};
exports.createBillReminder = createBillReminder;
/**
 * Mark bill as paid
 */
const markBillAsPaid = async (req, res, next) => {
    var _a, _b;
    try {
        const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.uid;
        const { billId } = req.params;
        const { paidDate } = req.body;
        if (!userId) {
            throw new errorHandler_1.AppError('Unauthorized: User ID missing', 401, true);
        }
        if (!firebase_1.db) {
            throw new errorHandler_1.AppError('Database not initialized', 500, false);
        }
        const billRef = firebase_1.db.collection('billReminders').doc(billId);
        const billDoc = await billRef.get();
        if (!billDoc.exists) {
            throw new errorHandler_1.AppError('Bill reminder not found', 404, true);
        }
        const billData = billDoc.data();
        if (billData.userId !== userId) {
            throw new errorHandler_1.AppError('Forbidden: Access denied', 403, true);
        }
        await billRef.update({
            isPaid: true,
            paidDate: paidDate || new Date().toISOString(),
            updatedAt: new Date().toISOString()
        });
        // Invalidate caches
        await Promise.all([
            cache_1.default.invalidatePatternAsync(`bills:${userId}:*`),
            cache_1.default.delAsync(buildBillCacheKey(billId))
        ]);
        res.json({ success: true, message: 'Bill marked as paid successfully' });
    }
    catch (error) {
        if (error instanceof errorHandler_1.AppError) {
            next(error);
            return;
        }
        logger_1.default.error('Error marking bill as paid', {
            error: error instanceof Error ? error.message : 'Unknown error',
            billId: req.params.billId,
            userId: (_b = req.user) === null || _b === void 0 ? void 0 : _b.uid
        });
        next(new errorHandler_1.AppError('Failed to mark bill as paid', 500, false));
    }
};
exports.markBillAsPaid = markBillAsPaid;
/**
 * Update bill reminder
 */
const updateBillReminder = async (req, res, next) => {
    var _a, _b, _c, _d;
    try {
        const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.uid;
        const { billId } = req.params;
        if (!userId) {
            throw new errorHandler_1.AppError('Unauthorized: User ID missing', 401, true);
        }
        if (!firebase_1.db) {
            throw new errorHandler_1.AppError('Database not initialized', 500, false);
        }
        const billRef = firebase_1.db.collection('billReminders').doc(billId);
        const billDoc = await billRef.get();
        if (!billDoc.exists) {
            throw new errorHandler_1.AppError('Bill reminder not found', 404, true);
        }
        const billData = billDoc.data();
        if (billData.userId !== userId) {
            throw new errorHandler_1.AppError('Forbidden: Access denied', 403, true);
        }
        // Whitelist only allowed updatable fields to prevent protected field modification
        const updateData = {
            updatedAt: new Date().toISOString()
        };
        // Validate and assign fields from request body
        if (req.body.name !== undefined) {
            if (typeof req.body.name !== 'string' || req.body.name.trim().length === 0) {
                throw new errorHandler_1.AppError('Name must be a non-empty string', 400, true);
            }
            if (req.body.name.length > 100) {
                throw new errorHandler_1.AppError('Name cannot exceed 100 characters', 400, true);
            }
            updateData.name = req.body.name.trim();
        }
        if (req.body.amount !== undefined) {
            const numericAmount = Number(req.body.amount);
            if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
                throw new errorHandler_1.AppError('Amount must be a positive number', 400, true);
            }
            updateData.amount = numericAmount;
        }
        if (req.body.dueDate !== undefined) {
            if (typeof req.body.dueDate !== 'string' || isNaN(Date.parse(req.body.dueDate))) {
                throw new errorHandler_1.AppError('Due date must be a valid date', 400, true);
            }
            updateData.dueDate = req.body.dueDate;
        }
        if (req.body.frequency !== undefined) {
            const validFrequencies = ['weekly', 'monthly', 'quarterly', 'yearly', 'one-time'];
            if (!validFrequencies.includes(req.body.frequency)) {
                throw new errorHandler_1.AppError(`Frequency must be one of: ${validFrequencies.join(', ')}`, 400, true);
            }
            updateData.frequency = req.body.frequency;
        }
        if (req.body.category !== undefined) {
            if (typeof req.body.category !== 'string' || req.body.category.trim().length === 0) {
                throw new errorHandler_1.AppError('Category must be a non-empty string', 400, true);
            }
            updateData.category = req.body.category.trim();
        }
        if (req.body.description !== undefined) {
            updateData.description = ((_b = req.body.description) === null || _b === void 0 ? void 0 : _b.trim()) || undefined;
        }
        if (req.body.reminderDays !== undefined) {
            if (!Array.isArray(req.body.reminderDays) || req.body.reminderDays.some((d) => typeof d !== 'number' || d < 0 || d > 365)) {
                throw new errorHandler_1.AppError('Reminder days must be an array of numbers between 0 and 365', 400, true);
            }
            updateData.reminderDays = req.body.reminderDays;
        }
        if (req.body.autoPayEnabled !== undefined) {
            if (typeof req.body.autoPayEnabled !== 'boolean') {
                throw new errorHandler_1.AppError('Auto pay enabled must be a boolean', 400, true);
            }
            updateData.autoPayEnabled = req.body.autoPayEnabled;
        }
        if (req.body.linkedAccount !== undefined) {
            updateData.linkedAccount = ((_c = req.body.linkedAccount) === null || _c === void 0 ? void 0 : _c.trim()) || undefined;
        }
        await billRef.update(updateData);
        // Invalidate caches
        await Promise.all([
            cache_1.default.invalidatePatternAsync(`bills:${userId}:*`),
            cache_1.default.delAsync(buildBillCacheKey(billId))
        ]);
        res.json({ success: true, message: 'Bill reminder updated successfully' });
    }
    catch (error) {
        if (error instanceof errorHandler_1.AppError) {
            next(error);
            return;
        }
        logger_1.default.error('Error updating bill reminder', {
            error: error instanceof Error ? error.message : 'Unknown error',
            billId: req.params.billId,
            userId: (_d = req.user) === null || _d === void 0 ? void 0 : _d.uid
        });
        next(new errorHandler_1.AppError('Failed to update bill reminder', 500, false));
    }
};
exports.updateBillReminder = updateBillReminder;
/**
 * Delete bill reminder
 */
const deleteBillReminder = async (req, res, next) => {
    var _a, _b;
    try {
        const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.uid;
        const { billId } = req.params;
        if (!userId) {
            throw new errorHandler_1.AppError('Unauthorized: User ID missing', 401, true);
        }
        if (!firebase_1.db) {
            throw new errorHandler_1.AppError('Database not initialized', 500, false);
        }
        const billRef = firebase_1.db.collection('billReminders').doc(billId);
        const billDoc = await billRef.get();
        if (!billDoc.exists) {
            throw new errorHandler_1.AppError('Bill reminder not found', 404, true);
        }
        const billData = billDoc.data();
        if (billData.userId !== userId) {
            throw new errorHandler_1.AppError('Forbidden: Access denied', 403, true);
        }
        await billRef.delete();
        // Invalidate caches
        await Promise.all([
            cache_1.default.invalidatePatternAsync(`bills:${userId}:*`),
            cache_1.default.delAsync(buildBillCacheKey(billId))
        ]);
        res.json({ success: true, message: 'Bill reminder deleted successfully' });
    }
    catch (error) {
        if (error instanceof errorHandler_1.AppError) {
            next(error);
            return;
        }
        logger_1.default.error('Error deleting bill reminder', {
            error: error instanceof Error ? error.message : 'Unknown error',
            billId: req.params.billId,
            userId: (_b = req.user) === null || _b === void 0 ? void 0 : _b.uid
        });
        next(new errorHandler_1.AppError('Failed to delete bill reminder', 500, false));
    }
};
exports.deleteBillReminder = deleteBillReminder;
