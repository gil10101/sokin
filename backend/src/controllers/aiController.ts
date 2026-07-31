import { Request, Response, NextFunction } from 'express';
import { db } from '../config/firebase';
import { AppError } from '../middleware/errorHandler';
import {
  isAiConfigured,
  suggestExpenseCategory,
  generateSpendingInsight,
  AiUnavailableError,
  SpendingFacts,
} from '../services/aiService';
import { buildSpendingFacts } from './dashboardController';

/**
 * The categories the app can actually store and group by. The model picks from
 * this list rather than inventing a label, so a suggestion always lands in a
 * bucket the charts and filters already understand.
 */
export const EXPENSE_CATEGORIES = [
  'dining',
  'food',
  'shopping',
  'transport',
  'utilities',
  'housing',
  'entertainment',
  'health',
  'travel',
  'other',
];

/** AI is optional: an unconfigured install answers 503, not 500. */
function respondUnavailable(res: Response, error: AiUnavailableError): void {
  const status = error.reason === 'rate_limited' ? 429 : 503;
  res.status(status).json({
    success: false,
    error: error.message,
    reason: error.reason,
  });
}

/**
 * GET /api/ai/status
 * Lets the client hide AI affordances entirely rather than offering a button
 * that always fails.
 */
export const getAiStatus = async (_req: Request, res: Response): Promise<void> => {
  res.json({ success: true, data: { available: isAiConfigured() } });
};

/**
 * POST /api/ai/categorize
 * Suggests a category for an expense the user is entering.
 */
export const categorizeExpense = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user?.uid) {
      throw new AppError('Unauthorized: User ID missing', 401, true);
    }

    const { name, amount, description } = req.body ?? {};

    if (typeof name !== 'string' || name.trim().length === 0) {
      throw new AppError('A merchant or description is required to categorize', 400, true);
    }
    const numericAmount = Number(amount);
    if (!Number.isFinite(numericAmount)) {
      throw new AppError('A numeric amount is required to categorize', 400, true);
    }

    const suggestion = await suggestExpenseCategory({
      name: name.trim().slice(0, 200),
      amount: numericAmount,
      description: typeof description === 'string' ? description.slice(0, 500) : undefined,
      allowedCategories: EXPENSE_CATEGORIES,
    });

    res.json({ success: true, data: suggestion });
  } catch (error) {
    if (error instanceof AiUnavailableError) {
      respondUnavailable(res, error);
      return;
    }
    next(error);
  }
};

/**
 * GET /api/ai/insights
 * Summarizes the month in prose, from the same aggregates the dashboard renders.
 */
export const getSpendingInsights = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.uid;
    if (!userId) {
      throw new AppError('Unauthorized: User ID missing', 401, true);
    }
    if (!db) {
      throw new AppError('Database not initialized', 500, false);
    }

    const facts: SpendingFacts | null = await buildSpendingFacts(userId);
    if (!facts) {
      res.status(422).json({
        success: false,
        error: 'Not enough spending data yet to summarize.',
        reason: 'insufficient_data',
      });
      return;
    }

    const insight = await generateSpendingInsight(facts);

    // Returned alongside the prose so the client can show what the summary was
    // computed from - an unsourced AI claim about someone's money is not worth
    // showing.
    res.json({ success: true, data: { insight, facts } });
  } catch (error) {
    if (error instanceof AiUnavailableError) {
      respondUnavailable(res, error);
      return;
    }
    next(error);
  }
};
