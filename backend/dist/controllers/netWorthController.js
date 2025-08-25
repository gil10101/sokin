"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateNetWorthSnapshot = exports.calculateUserNetWorth = exports.getNetWorthInsights = exports.getNetWorthTrends = exports.getNetWorthHistory = exports.calculateNetWorth = exports.deleteLiability = exports.updateLiability = exports.createLiability = exports.getUserLiabilities = exports.deleteAsset = exports.updateAsset = exports.createAsset = exports.getUserAssets = void 0;
const firebase_1 = require("../config/firebase");
/**
 * Asset Management Controllers
 */
// Get all assets for a user
const getUserAssets = async (req, res) => {
    var _a;
    try {
        const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.uid;
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        if (!firebase_1.db) {
            return res.status(500).json({ error: 'Database not initialized' });
        }
        const assetsRef = firebase_1.db.collection('assets');
        const snapshot = await assetsRef
            .where('userId', '==', userId)
            .orderBy('createdAt', 'desc')
            .get();
        const assets = [];
        snapshot.forEach(doc => {
            assets.push({ id: doc.id, ...doc.data() });
        });
        res.json({ data: assets });
    }
    catch (error) {
        console.error('Error fetching assets:', error);
        res.status(500).json({ error: 'Failed to fetch assets' });
    }
};
exports.getUserAssets = getUserAssets;
// Create a new asset
const createAsset = async (req, res) => {
    var _a;
    try {
        const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.uid;
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        if (!firebase_1.db) {
            return res.status(500).json({ error: 'Database not initialized' });
        }
        const assetData = req.body;
        const now = new Date().toISOString();
        const newAsset = {
            userId,
            type: assetData.type,
            category: assetData.category,
            name: assetData.name,
            currentValue: assetData.currentValue,
            description: assetData.description,
            metadata: assetData.metadata,
            lastUpdated: now,
            createdAt: now,
        };
        const docRef = await firebase_1.db.collection('assets').add(newAsset);
        const createdAsset = { id: docRef.id, ...newAsset };
        // Trigger net worth recalculation
        await (0, exports.updateNetWorthSnapshot)(userId);
        res.status(201).json({ data: createdAsset });
    }
    catch (error) {
        console.error('Error creating asset:', error);
        res.status(500).json({ error: 'Failed to create asset' });
    }
};
exports.createAsset = createAsset;
// Update an asset
const updateAsset = async (req, res) => {
    var _a;
    try {
        const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.uid;
        const assetId = req.params.id;
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        if (!firebase_1.db) {
            return res.status(500).json({ error: 'Database not initialized' });
        }
        const assetRef = firebase_1.db.collection('assets').doc(assetId);
        const assetDoc = await assetRef.get();
        if (!assetDoc.exists) {
            return res.status(404).json({ error: 'Asset not found' });
        }
        const assetData = assetDoc.data();
        if (assetData.userId !== userId) {
            return res.status(403).json({ error: 'Forbidden: Not your asset' });
        }
        const updateData = req.body;
        const now = new Date().toISOString();
        const updatedFields = {
            ...updateData,
            lastUpdated: now,
            updatedAt: now,
        };
        await assetRef.update(updatedFields);
        // Trigger net worth recalculation
        await (0, exports.updateNetWorthSnapshot)(userId);
        const updatedAsset = { id: assetId, ...assetData, ...updatedFields };
        res.json({ data: updatedAsset });
    }
    catch (error) {
        console.error('Error updating asset:', error);
        res.status(500).json({ error: 'Failed to update asset' });
    }
};
exports.updateAsset = updateAsset;
// Delete an asset
const deleteAsset = async (req, res) => {
    var _a;
    try {
        const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.uid;
        const assetId = req.params.id;
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        if (!firebase_1.db) {
            return res.status(500).json({ error: 'Database not initialized' });
        }
        const assetRef = firebase_1.db.collection('assets').doc(assetId);
        const assetDoc = await assetRef.get();
        if (!assetDoc.exists) {
            return res.status(404).json({ error: 'Asset not found' });
        }
        const assetData = assetDoc.data();
        if (assetData.userId !== userId) {
            return res.status(403).json({ error: 'Forbidden: Not your asset' });
        }
        await assetRef.delete();
        // Trigger net worth recalculation
        await (0, exports.updateNetWorthSnapshot)(userId);
        res.json({ message: 'Asset deleted successfully' });
    }
    catch (error) {
        console.error('Error deleting asset:', error);
        res.status(500).json({ error: 'Failed to delete asset' });
    }
};
exports.deleteAsset = deleteAsset;
/**
 * Liability Management Controllers
 */
// Get all liabilities for a user
const getUserLiabilities = async (req, res) => {
    var _a;
    try {
        const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.uid;
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        if (!firebase_1.db) {
            return res.status(500).json({ error: 'Database not initialized' });
        }
        const liabilitiesRef = firebase_1.db.collection('liabilities');
        const snapshot = await liabilitiesRef
            .where('userId', '==', userId)
            .orderBy('createdAt', 'desc')
            .get();
        const liabilities = [];
        snapshot.forEach(doc => {
            liabilities.push({ id: doc.id, ...doc.data() });
        });
        res.json({ data: liabilities });
    }
    catch (error) {
        console.error('Error fetching liabilities:', error);
        res.status(500).json({ error: 'Failed to fetch liabilities' });
    }
};
exports.getUserLiabilities = getUserLiabilities;
// Create a new liability
const createLiability = async (req, res) => {
    var _a;
    try {
        const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.uid;
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        if (!firebase_1.db) {
            return res.status(500).json({ error: 'Database not initialized' });
        }
        const liabilityData = req.body;
        const now = new Date().toISOString();
        const newLiability = {
            userId,
            type: liabilityData.type,
            category: liabilityData.category,
            name: liabilityData.name,
            currentBalance: liabilityData.currentBalance,
            originalAmount: liabilityData.originalAmount,
            interestRate: liabilityData.interestRate,
            minimumPayment: liabilityData.minimumPayment,
            dueDate: liabilityData.dueDate,
            metadata: liabilityData.metadata,
            createdAt: now,
        };
        const docRef = await firebase_1.db.collection('liabilities').add(newLiability);
        const createdLiability = { id: docRef.id, ...newLiability };
        // Trigger net worth recalculation
        await (0, exports.updateNetWorthSnapshot)(userId);
        res.status(201).json({ data: createdLiability });
    }
    catch (error) {
        console.error('Error creating liability:', error);
        res.status(500).json({ error: 'Failed to create liability' });
    }
};
exports.createLiability = createLiability;
// Update a liability
const updateLiability = async (req, res) => {
    var _a;
    try {
        const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.uid;
        const liabilityId = req.params.id;
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        if (!firebase_1.db) {
            return res.status(500).json({ error: 'Database not initialized' });
        }
        const liabilityRef = firebase_1.db.collection('liabilities').doc(liabilityId);
        const liabilityDoc = await liabilityRef.get();
        if (!liabilityDoc.exists) {
            return res.status(404).json({ error: 'Liability not found' });
        }
        const liabilityData = liabilityDoc.data();
        if (liabilityData.userId !== userId) {
            return res.status(403).json({ error: 'Forbidden: Not your liability' });
        }
        const updateData = req.body;
        const now = new Date().toISOString();
        const updatedFields = {
            ...updateData,
            updatedAt: now,
        };
        await liabilityRef.update(updatedFields);
        // Trigger net worth recalculation
        await (0, exports.updateNetWorthSnapshot)(userId);
        const updatedLiability = { id: liabilityId, ...liabilityData, ...updatedFields };
        res.json({ data: updatedLiability });
    }
    catch (error) {
        console.error('Error updating liability:', error);
        res.status(500).json({ error: 'Failed to update liability' });
    }
};
exports.updateLiability = updateLiability;
// Delete a liability
const deleteLiability = async (req, res) => {
    var _a;
    try {
        const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.uid;
        const liabilityId = req.params.id;
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        if (!firebase_1.db) {
            return res.status(500).json({ error: 'Database not initialized' });
        }
        const liabilityRef = firebase_1.db.collection('liabilities').doc(liabilityId);
        const liabilityDoc = await liabilityRef.get();
        if (!liabilityDoc.exists) {
            return res.status(404).json({ error: 'Liability not found' });
        }
        const liabilityData = liabilityDoc.data();
        if (liabilityData.userId !== userId) {
            return res.status(403).json({ error: 'Forbidden: Not your liability' });
        }
        await liabilityRef.delete();
        // Trigger net worth recalculation
        await (0, exports.updateNetWorthSnapshot)(userId);
        res.json({ message: 'Liability deleted successfully' });
    }
    catch (error) {
        console.error('Error deleting liability:', error);
        res.status(500).json({ error: 'Failed to delete liability' });
    }
};
exports.deleteLiability = deleteLiability;
/**
 * Net Worth Calculation and Snapshot Controllers
 */
// Calculate current net worth
const calculateNetWorth = async (req, res) => {
    var _a;
    try {
        const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.uid;
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        console.log('Calculating net worth for user:', userId);
        if (!firebase_1.db) {
            console.log('Database not initialized, returning empty calculation');
            // Return empty calculation for development mode
            const emptyCalculation = {
                userId,
                calculatedAt: new Date().toISOString(),
                totalAssets: 0,
                totalLiabilities: 0,
                netWorth: 0,
                assetBreakdown: {
                    bankAccounts: 0,
                    investmentAccounts: 0,
                    realEstate: 0,
                    vehicles: 0,
                    otherValuables: 0,
                },
                liabilityBreakdown: {
                    creditCards: 0,
                    mortgages: 0,
                    studentLoans: 0,
                    autoLoans: 0,
                    personalLoans: 0,
                    otherDebts: 0,
                },
                assets: [],
                liabilities: [],
                monthlyChange: 0,
                monthlyChangePercent: 0,
            };
            return res.json({ data: emptyCalculation });
        }
        const calculation = await (0, exports.calculateUserNetWorth)(userId);
        res.json({ data: calculation });
    }
    catch (error) {
        console.error('Error calculating net worth:', error);
        console.error('Error details:', error);
        res.status(500).json({ error: 'Failed to calculate net worth' });
    }
};
exports.calculateNetWorth = calculateNetWorth;
// Get net worth history/snapshots
const getNetWorthHistory = async (req, res) => {
    var _a;
    try {
        const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.uid;
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        if (!firebase_1.db) {
            return res.status(500).json({ error: 'Database not initialized' });
        }
        const limit = parseInt(req.query.limit) || 12; // Default 12 months
        const snapshotsRef = firebase_1.db.collection('netWorthSnapshots');
        const snapshot = await snapshotsRef
            .where('userId', '==', userId)
            .orderBy('date', 'desc')
            .limit(limit)
            .get();
        const snapshots = [];
        snapshot.forEach(doc => {
            snapshots.push({ id: doc.id, ...doc.data() });
        });
        res.json({ data: snapshots.reverse() }); // Return in chronological order
    }
    catch (error) {
        console.error('Error fetching net worth history:', error);
        res.status(500).json({ error: 'Failed to fetch net worth history' });
    }
};
exports.getNetWorthHistory = getNetWorthHistory;
// Get net worth trends
const getNetWorthTrends = async (req, res) => {
    var _a;
    try {
        const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.uid;
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        console.log('Getting net worth trends for user:', userId);
        if (!firebase_1.db) {
            console.log('Database not initialized, returning empty trends');
            // Return empty trends for development mode
            return res.json({ data: [] });
        }
        const months = parseInt(req.query.months) || 12;
        console.log('Requesting trends for months:', months);
        try {
            const snapshotsRef = firebase_1.db.collection('netWorthSnapshots');
            console.log('Querying netWorthSnapshots collection...');
            const snapshot = await snapshotsRef
                .where('userId', '==', userId)
                .orderBy('date', 'desc')
                .limit(months)
                .get();
            console.log('Query executed successfully. Found', snapshot.size, 'snapshots');
            const snapshots = [];
            snapshot.forEach(doc => {
                const data = doc.data();
                console.log('Processing snapshot:', doc.id, 'with date:', data.date);
                snapshots.push(data);
            });
            console.log('Total snapshots processed:', snapshots.length);
            if (snapshots.length === 0) {
                console.log('No snapshots found, returning empty trends');
                return res.json({ data: [] });
            }
            snapshots.reverse(); // Chronological order
            const trends = snapshots.map((snap, index) => {
                try {
                    const prevSnap = index > 0 ? snapshots[index - 1] : null;
                    const monthlyChange = prevSnap ? snap.netWorth - prevSnap.netWorth : 0;
                    const monthlyChangePercent = prevSnap && prevSnap.netWorth !== 0
                        ? (monthlyChange / Math.abs(prevSnap.netWorth)) * 100
                        : 0;
                    // Ensure date is a string and extract period
                    const period = snap.date.substring(0, 7); // YYYY-MM format
                    return {
                        period,
                        netWorth: snap.netWorth,
                        totalAssets: snap.totalAssets,
                        totalLiabilities: snap.totalLiabilities,
                        monthlyChange,
                        monthlyChangePercent,
                    };
                }
                catch (mapError) {
                    console.error('Error processing snapshot at index', index, ':', mapError);
                    console.error('Snapshot data:', snap);
                    throw mapError;
                }
            });
            console.log('Successfully processed', trends.length, 'trends');
            res.json({ data: trends });
        }
        catch (queryError) {
            console.error('Error during database query:', queryError);
            const error = queryError;
            console.error('Query error details:', {
                message: error.message,
                stack: error.stack
            });
            // If it's a missing index error, return empty data
            if (error.message && error.message.includes('index')) {
                console.log('Index error detected, returning empty trends');
                return res.json({ data: [] });
            }
            throw queryError;
        }
    }
    catch (err) {
        console.error('Error fetching net worth trends:', err);
        const error = err;
        console.error('Full error details:', {
            message: error.message,
            stack: error.stack,
            name: error.name
        });
        res.status(500).json({ error: 'Failed to fetch net worth trends' });
    }
};
exports.getNetWorthTrends = getNetWorthTrends;
// Get net worth insights
const getNetWorthInsights = async (req, res) => {
    var _a;
    try {
        const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.uid;
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        if (!firebase_1.db) {
            return res.status(500).json({ error: 'Database not initialized' });
        }
        const calculation = await (0, exports.calculateUserNetWorth)(userId);
        const insights = generateNetWorthInsights(calculation);
        res.json({ data: insights });
    }
    catch (error) {
        console.error('Error generating net worth insights:', error);
        res.status(500).json({ error: 'Failed to generate insights' });
    }
};
exports.getNetWorthInsights = getNetWorthInsights;
/**
 * Helper Functions
 */
// Calculate user's current net worth
const calculateUserNetWorth = async (userId) => {
    console.log('calculateUserNetWorth called for user:', userId);
    if (!firebase_1.db) {
        console.log('Database not initialized in calculateUserNetWorth');
        throw new Error('Database not initialized');
    }
    let assets = [];
    let liabilities = [];
    try {
        // Get all assets
        console.log('Fetching assets...');
        const assetsSnapshot = await firebase_1.db.collection('assets')
            .where('userId', '==', userId)
            .get();
        assetsSnapshot.forEach(doc => {
            assets.push({ id: doc.id, ...doc.data() });
        });
        console.log(`Found ${assets.length} assets`);
        // Get all liabilities
        console.log('Fetching liabilities...');
        const liabilitiesSnapshot = await firebase_1.db.collection('liabilities')
            .where('userId', '==', userId)
            .get();
        liabilitiesSnapshot.forEach(doc => {
            liabilities.push({ id: doc.id, ...doc.data() });
        });
        console.log(`Found ${liabilities.length} liabilities`);
    }
    catch (error) {
        console.error('Error fetching data from database:', error);
        // Continue with empty arrays if database fetch fails
        assets = [];
        liabilities = [];
    }
    // Calculate asset breakdown
    const assetBreakdown = {
        bankAccounts: 0,
        investmentAccounts: 0,
        realEstate: 0,
        vehicles: 0,
        otherValuables: 0,
    };
    assets.forEach(asset => {
        switch (asset.category) {
            case 'bank_accounts':
                assetBreakdown.bankAccounts += asset.currentValue;
                break;
            case 'investment_accounts':
                assetBreakdown.investmentAccounts += asset.currentValue;
                break;
            case 'real_estate':
                assetBreakdown.realEstate += asset.currentValue;
                break;
            case 'vehicles':
                assetBreakdown.vehicles += asset.currentValue;
                break;
            case 'other_valuables':
                assetBreakdown.otherValuables += asset.currentValue;
                break;
        }
    });
    // Calculate liability breakdown
    const liabilityBreakdown = {
        creditCards: 0,
        mortgages: 0,
        studentLoans: 0,
        autoLoans: 0,
        personalLoans: 0,
        otherDebts: 0,
    };
    liabilities.forEach(liability => {
        switch (liability.category) {
            case 'credit_cards':
                liabilityBreakdown.creditCards += liability.currentBalance;
                break;
            case 'mortgages':
                liabilityBreakdown.mortgages += liability.currentBalance;
                break;
            case 'student_loans':
                liabilityBreakdown.studentLoans += liability.currentBalance;
                break;
            case 'auto_loans':
                liabilityBreakdown.autoLoans += liability.currentBalance;
                break;
            case 'personal_loans':
                liabilityBreakdown.personalLoans += liability.currentBalance;
                break;
            case 'other_debts':
                liabilityBreakdown.otherDebts += liability.currentBalance;
                break;
        }
    });
    const totalAssets = Object.values(assetBreakdown).reduce((sum, val) => sum + val, 0);
    const totalLiabilities = Object.values(liabilityBreakdown).reduce((sum, val) => sum + val, 0);
    const netWorth = totalAssets - totalLiabilities;
    // Get previous month's net worth for change calculation
    const prevMonth = new Date();
    prevMonth.setMonth(prevMonth.getMonth() - 1);
    const prevMonthStr = prevMonth.toISOString().substring(0, 7);
    const prevSnapshot = await firebase_1.db.collection('netWorthSnapshots')
        .where('userId', '==', userId)
        .where('date', '>=', prevMonthStr)
        .where('date', '<', prevMonthStr + '-32')
        .limit(1)
        .get();
    let monthlyChange = 0;
    let monthlyChangePercent = 0;
    if (!prevSnapshot.empty) {
        const prevData = prevSnapshot.docs[0].data();
        monthlyChange = netWorth - prevData.netWorth;
        monthlyChangePercent = prevData.netWorth !== 0
            ? (monthlyChange / Math.abs(prevData.netWorth)) * 100
            : 0;
    }
    return {
        userId,
        calculatedAt: new Date().toISOString(),
        totalAssets,
        totalLiabilities,
        netWorth,
        assetBreakdown,
        liabilityBreakdown,
        assets,
        liabilities,
        monthlyChange,
        monthlyChangePercent,
    };
};
exports.calculateUserNetWorth = calculateUserNetWorth;
// Update/create monthly net worth snapshot
const updateNetWorthSnapshot = async (userId) => {
    try {
        if (!firebase_1.db) {
            throw new Error('Database not initialized');
        }
        const calculation = await (0, exports.calculateUserNetWorth)(userId);
        const now = new Date();
        const currentMonth = now.toISOString().substring(0, 7); // YYYY-MM
        // Check if snapshot exists for current month
        const existingSnapshot = await firebase_1.db.collection('netWorthSnapshots')
            .where('userId', '==', userId)
            .where('date', '>=', currentMonth)
            .where('date', '<', currentMonth + '-32')
            .limit(1)
            .get();
        const snapshotData = {
            userId,
            date: now.toISOString().substring(0, 10), // YYYY-MM-DD
            netWorth: calculation.netWorth,
            totalAssets: calculation.totalAssets,
            totalLiabilities: calculation.totalLiabilities,
            assetBreakdown: calculation.assetBreakdown,
            liabilityBreakdown: calculation.liabilityBreakdown,
            createdAt: now.toISOString(),
            metadata: {
                calculationMethod: 'automatic',
                monthlyChange: calculation.monthlyChange,
                monthlyChangePercent: calculation.monthlyChangePercent,
            },
        };
        if (existingSnapshot.empty) {
            // Create new snapshot
            await firebase_1.db.collection('netWorthSnapshots').add(snapshotData);
        }
        else {
            // Update existing snapshot
            await existingSnapshot.docs[0].ref.update(snapshotData);
        }
    }
    catch (error) {
        console.error('Error updating net worth snapshot:', error);
    }
};
exports.updateNetWorthSnapshot = updateNetWorthSnapshot;
// Generate insights based on net worth calculation
const generateNetWorthInsights = (calculation) => {
    const insights = [];
    // Net worth trend insight
    if (calculation.monthlyChange !== undefined) {
        if (calculation.monthlyChange > 0) {
            insights.push({
                type: 'positive',
                title: 'Net Worth Growing',
                description: `Your net worth increased by $${calculation.monthlyChange.toLocaleString()} this month. Keep up the great work!`,
                value: calculation.monthlyChange,
                priority: 'medium',
            });
        }
        else if (calculation.monthlyChange < -1000) {
            insights.push({
                type: 'warning',
                title: 'Net Worth Declined',
                description: `Your net worth decreased by $${Math.abs(calculation.monthlyChange).toLocaleString()} this month. Consider reviewing your expenses.`,
                value: Math.abs(calculation.monthlyChange),
                priority: 'high',
                actionable: true,
            });
        }
    }
    // Asset allocation insights
    const assetTotal = calculation.totalAssets;
    if (assetTotal > 0) {
        const cashRatio = calculation.assetBreakdown.bankAccounts / assetTotal;
        const investmentRatio = calculation.assetBreakdown.investmentAccounts / assetTotal;
        if (cashRatio > 0.3) {
            insights.push({
                type: 'info',
                title: 'High Cash Allocation',
                description: `${(cashRatio * 100).toFixed(1)}% of your assets are in cash. Consider investing some for long-term growth.`,
                priority: 'medium',
                actionable: true,
            });
        }
        if (investmentRatio < 0.1 && assetTotal > 10000) {
            insights.push({
                type: 'info',
                title: 'Low Investment Allocation',
                description: 'Consider increasing your investment allocation for long-term wealth building.',
                priority: 'medium',
                actionable: true,
            });
        }
    }
    // Debt-to-asset ratio insight
    if (calculation.totalAssets > 0) {
        const debtRatio = calculation.totalLiabilities / calculation.totalAssets;
        if (debtRatio > 0.4) {
            insights.push({
                type: 'warning',
                title: 'High Debt Ratio',
                description: `Your debt represents ${(debtRatio * 100).toFixed(1)}% of your assets. Focus on debt reduction.`,
                priority: 'high',
                actionable: true,
            });
        }
    }
    return insights;
};
