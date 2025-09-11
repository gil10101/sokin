"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BillRemindersController = void 0;
const firebase_1 = require("../config/firebase");
const logger_1 = __importDefault(require("../utils/logger"));
class BillRemindersController {
    // Get user's bill reminders
    static async getUserBillReminders(req, res) {
        var _a, _b;
        try {
            const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.uid;
            if (!userId) {
                return res.status(401).json({ error: 'Unauthorized' });
            }
            if (!firebase_1.db) {
                return res.status(500).json({ error: 'Database not initialized' });
            }
            const billsRef = firebase_1.db.collection('billReminders');
            const snapshot = await billsRef.where('userId', '==', userId).get();
            const bills = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            res.json({ bills });
        }
        catch (error) {
            logger_1.default.error('Error fetching bill reminders', { error: error instanceof Error ? error.message : 'Unknown error', userId: (_b = req.user) === null || _b === void 0 ? void 0 : _b.uid });
            res.status(500).json({ error: 'Failed to fetch bill reminders' });
        }
    }
    // Create new bill reminder
    static async createBillReminder(req, res) {
        var _a, _b;
        try {
            const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.uid;
            if (!userId) {
                return res.status(401).json({ error: 'Unauthorized' });
            }
            if (!firebase_1.db) {
                return res.status(500).json({ error: 'Database not initialized' });
            }
            const billData = {
                userId,
                name: req.body.name,
                amount: req.body.amount,
                dueDate: req.body.dueDate,
                frequency: req.body.frequency,
                category: req.body.category,
                description: req.body.description,
                isPaid: false,
                reminderDays: req.body.reminderDays || [7, 3, 1],
                autoPayEnabled: req.body.autoPayEnabled || false,
                linkedAccount: req.body.linkedAccount,
                createdAt: new Date().toISOString()
            };
            const docRef = await firebase_1.db.collection('billReminders').add(billData);
            const newBill = { id: docRef.id, ...billData };
            res.status(201).json({ bill: newBill });
        }
        catch (error) {
            logger_1.default.error('Error creating bill reminder', { error: error instanceof Error ? error.message : 'Unknown error', userId: (_b = req.user) === null || _b === void 0 ? void 0 : _b.uid });
            res.status(500).json({ error: 'Failed to create bill reminder' });
        }
    }
    // Mark bill as paid
    static async markBillAsPaid(req, res) {
        var _a, _b;
        try {
            const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.uid;
            const { billId } = req.params;
            const { paidDate } = req.body;
            if (!userId) {
                return res.status(401).json({ error: 'Unauthorized' });
            }
            if (!firebase_1.db) {
                return res.status(500).json({ error: 'Database not initialized' });
            }
            const billRef = firebase_1.db.collection('billReminders').doc(billId);
            const billDoc = await billRef.get();
            if (!billDoc.exists) {
                return res.status(404).json({ error: 'Bill reminder not found' });
            }
            const billData = billDoc.data();
            if (billData.userId !== userId) {
                return res.status(403).json({ error: 'Forbidden' });
            }
            await billRef.update({
                isPaid: true,
                paidDate: paidDate || new Date().toISOString(),
                updatedAt: new Date().toISOString()
            });
            res.json({ success: true });
        }
        catch (error) {
            logger_1.default.error('Error marking bill as paid', { error: error instanceof Error ? error.message : 'Unknown error', billId: req.params.billId, userId: (_b = req.user) === null || _b === void 0 ? void 0 : _b.uid });
            res.status(500).json({ error: 'Failed to mark bill as paid' });
        }
    }
    // Update bill reminder
    static async updateBillReminder(req, res) {
        var _a, _b;
        try {
            const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.uid;
            const { billId } = req.params;
            if (!userId) {
                return res.status(401).json({ error: 'Unauthorized' });
            }
            if (!firebase_1.db) {
                return res.status(500).json({ error: 'Database not initialized' });
            }
            const billRef = firebase_1.db.collection('billReminders').doc(billId);
            const billDoc = await billRef.get();
            if (!billDoc.exists) {
                return res.status(404).json({ error: 'Bill reminder not found' });
            }
            const billData = billDoc.data();
            if (billData.userId !== userId) {
                return res.status(403).json({ error: 'Forbidden' });
            }
            const updateData = {
                ...req.body,
                updatedAt: new Date().toISOString()
            };
            await billRef.update(updateData);
            res.json({ success: true });
        }
        catch (error) {
            logger_1.default.error('Error updating bill reminder', { error: error instanceof Error ? error.message : 'Unknown error', billId: req.params.billId, userId: (_b = req.user) === null || _b === void 0 ? void 0 : _b.uid });
            res.status(500).json({ error: 'Failed to update bill reminder' });
        }
    }
    // Delete bill reminder
    static async deleteBillReminder(req, res) {
        var _a, _b;
        try {
            const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.uid;
            const { billId } = req.params;
            if (!userId) {
                return res.status(401).json({ error: 'Unauthorized' });
            }
            if (!firebase_1.db) {
                return res.status(500).json({ error: 'Database not initialized' });
            }
            const billRef = firebase_1.db.collection('billReminders').doc(billId);
            const billDoc = await billRef.get();
            if (!billDoc.exists) {
                return res.status(404).json({ error: 'Bill reminder not found' });
            }
            const billData = billDoc.data();
            if (billData.userId !== userId) {
                return res.status(403).json({ error: 'Forbidden' });
            }
            await billRef.delete();
            res.json({ success: true });
        }
        catch (error) {
            logger_1.default.error('Error deleting bill reminder', { error: error instanceof Error ? error.message : 'Unknown error', billId: req.params.billId, userId: (_b = req.user) === null || _b === void 0 ? void 0 : _b.uid });
            res.status(500).json({ error: 'Failed to delete bill reminder' });
        }
    }
}
exports.BillRemindersController = BillRemindersController;
