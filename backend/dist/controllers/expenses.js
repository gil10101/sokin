"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteExpense = exports.updateExpense = exports.createExpense = exports.getExpenseById = exports.getAllExpenses = void 0;
const firebase_1 = require("../config/firebase");
// Get all expenses for a user
const getAllExpenses = async (req, res) => {
    try {
        if (!req.user || !req.user.uid) {
            res.status(401).json({ error: 'Unauthorized: User ID missing' });
            return;
        }
        const expensesRef = firebase_1.db.collection('expenses');
        const expensesSnapshot = await expensesRef.where('userId', '==', req.user.uid).get();
        const expenses = expensesSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        res.status(200).json({ data: expenses });
    }
    catch (error) {
        console.error('Error fetching expenses:', error);
        res.status(500).json({ error: 'Failed to fetch expenses' });
    }
};
exports.getAllExpenses = getAllExpenses;
// Get a specific expense
const getExpenseById = async (req, res) => {
    try {
        if (!req.user || !req.user.uid) {
            res.status(401).json({ error: 'Unauthorized: User ID missing' });
            return;
        }
        const expenseId = req.params.id;
        const expenseDoc = await firebase_1.db.collection('expenses').doc(expenseId).get();
        if (!expenseDoc.exists) {
            res.status(404).json({ error: 'Expense not found' });
            return;
        }
        const expenseData = expenseDoc.data();
        // Verify the expense belongs to the requesting user
        if (expenseData.userId !== req.user.uid) {
            res.status(403).json({ error: 'Forbidden: You do not have access to this expense' });
            return;
        }
        res.status(200).json({
            data: {
                id: expenseDoc.id,
                ...expenseData
            }
        });
    }
    catch (error) {
        console.error('Error fetching expense:', error);
        res.status(500).json({ error: 'Failed to fetch expense' });
    }
};
exports.getExpenseById = getExpenseById;
// Create a new expense
const createExpense = async (req, res) => {
    try {
        if (!req.user || !req.user.uid) {
            res.status(401).json({ error: 'Unauthorized: User ID missing' });
            return;
        }
        const { amount, date, category, description, tags } = req.body;
        // Basic validation
        if (!amount || !date || !category) {
            res.status(400).json({ error: 'Missing required fields: amount, date, and category are required' });
            return;
        }
        const expenseData = {
            userId: req.user.uid,
            amount: Number(amount),
            date,
            category,
            description: description || '',
            tags: tags || [],
            createdAt: new Date().toISOString(),
        };
        const expenseRef = await firebase_1.db.collection('expenses').add(expenseData);
        res.status(201).json({
            data: {
                id: expenseRef.id,
                ...expenseData
            },
            message: 'Expense created successfully'
        });
    }
    catch (error) {
        console.error('Error creating expense:', error);
        res.status(500).json({ error: 'Failed to create expense' });
    }
};
exports.createExpense = createExpense;
// Update an expense
const updateExpense = async (req, res) => {
    try {
        if (!req.user || !req.user.uid) {
            res.status(401).json({ error: 'Unauthorized: User ID missing' });
            return;
        }
        const expenseId = req.params.id;
        const expenseDoc = await firebase_1.db.collection('expenses').doc(expenseId).get();
        if (!expenseDoc.exists) {
            res.status(404).json({ error: 'Expense not found' });
            return;
        }
        const expenseData = expenseDoc.data();
        // Verify the expense belongs to the requesting user
        if (expenseData.userId !== req.user.uid) {
            res.status(403).json({ error: 'Forbidden: You do not have access to this expense' });
            return;
        }
        const { amount, date, category, description, tags } = req.body;
        // Build update object with only provided fields
        const updateData = {};
        if (amount !== undefined)
            updateData.amount = Number(amount);
        if (date)
            updateData.date = date;
        if (category)
            updateData.category = category;
        if (description !== undefined)
            updateData.description = description;
        if (tags)
            updateData.tags = tags;
        updateData.updatedAt = new Date().toISOString();
        await firebase_1.db.collection('expenses').doc(expenseId).update(updateData);
        res.status(200).json({
            data: {
                id: expenseId,
                ...expenseData,
                ...updateData
            },
            message: 'Expense updated successfully'
        });
    }
    catch (error) {
        console.error('Error updating expense:', error);
        res.status(500).json({ error: 'Failed to update expense' });
    }
};
exports.updateExpense = updateExpense;
// Delete an expense
const deleteExpense = async (req, res) => {
    try {
        if (!req.user || !req.user.uid) {
            res.status(401).json({ error: 'Unauthorized: User ID missing' });
            return;
        }
        const expenseId = req.params.id;
        const expenseDoc = await firebase_1.db.collection('expenses').doc(expenseId).get();
        if (!expenseDoc.exists) {
            res.status(404).json({ error: 'Expense not found' });
            return;
        }
        const expenseData = expenseDoc.data();
        // Verify the expense belongs to the requesting user
        if (expenseData.userId !== req.user.uid) {
            res.status(403).json({ error: 'Forbidden: You do not have access to this expense' });
            return;
        }
        await firebase_1.db.collection('expenses').doc(expenseId).delete();
        res.status(200).json({
            message: 'Expense deleted successfully'
        });
    }
    catch (error) {
        console.error('Error deleting expense:', error);
        res.status(500).json({ error: 'Failed to delete expense' });
    }
};
exports.deleteExpense = deleteExpense;
