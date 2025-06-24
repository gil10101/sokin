"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateUserSchema = exports.updateBudgetSchema = exports.createBudgetSchema = exports.updateExpenseSchema = exports.createExpenseSchema = void 0;
const joi_1 = __importDefault(require("joi"));
// Expense schemas
exports.createExpenseSchema = joi_1.default.object({
    name: joi_1.default.string().required().trim(),
    amount: joi_1.default.number().required().positive(),
    date: joi_1.default.string().isoDate().required(),
    category: joi_1.default.string().required().trim(),
    description: joi_1.default.string().allow(''),
    tags: joi_1.default.array().items(joi_1.default.string()),
    receiptImageUrl: joi_1.default.string().uri().allow(''),
    receiptData: joi_1.default.object({
        merchant: joi_1.default.string().allow(''),
        confidence: joi_1.default.number().min(0).max(1),
        items: joi_1.default.array().items(joi_1.default.string()),
        rawText: joi_1.default.string().allow('')
    }).allow(null)
});
exports.updateExpenseSchema = joi_1.default.object({
    name: joi_1.default.string().trim(),
    amount: joi_1.default.number().positive(),
    date: joi_1.default.string().isoDate(),
    category: joi_1.default.string().trim(),
    description: joi_1.default.string().allow(''),
    tags: joi_1.default.array().items(joi_1.default.string()),
    receiptImageUrl: joi_1.default.string().uri().allow(''),
    receiptData: joi_1.default.object({
        merchant: joi_1.default.string().allow(''),
        confidence: joi_1.default.number().min(0).max(1),
        items: joi_1.default.array().items(joi_1.default.string()),
        rawText: joi_1.default.string().allow('')
    }).allow(null)
}).min(1);
// Budget schemas
exports.createBudgetSchema = joi_1.default.object({
    name: joi_1.default.string().required().trim(),
    amount: joi_1.default.number().required().positive(),
    period: joi_1.default.string().valid('daily', 'weekly', 'monthly', 'yearly').required(),
    categories: joi_1.default.array().items(joi_1.default.string()),
    startDate: joi_1.default.string().isoDate().required(),
    endDate: joi_1.default.string().isoDate()
});
exports.updateBudgetSchema = joi_1.default.object({
    name: joi_1.default.string().trim(),
    amount: joi_1.default.number().positive(),
    period: joi_1.default.string().valid('daily', 'weekly', 'monthly', 'yearly'),
    categories: joi_1.default.array().items(joi_1.default.string()),
    startDate: joi_1.default.string().isoDate(),
    endDate: joi_1.default.string().isoDate()
}).min(1);
// User schemas
exports.updateUserSchema = joi_1.default.object({
    displayName: joi_1.default.string().trim(),
    photoURL: joi_1.default.string().uri(),
    settings: joi_1.default.object({
        currency: joi_1.default.string().trim(),
        language: joi_1.default.string().trim(),
        theme: joi_1.default.string().valid('light', 'dark'),
        notificationsEnabled: joi_1.default.boolean()
    })
}).min(1);
