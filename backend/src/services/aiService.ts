import Anthropic from '@anthropic-ai/sdk';
import logger from '../utils/logger';

/**
 * Claude-backed features.
 *
 * Every entry point degrades rather than throws when ANTHROPIC_API_KEY is
 * absent, so the app runs unchanged without it - an AI feature that takes the
 * whole request down when a key is missing is worse than one that is simply
 * unavailable.
 */

const MODEL = 'claude-opus-5';

/**
 * Claude Opus 5's safety classifiers can decline a request outright. Routing a
 * declined request to Anthropic's recommended fallback recovers it server-side
 * instead of surfacing the refusal - relevant here because financial text can
 * occasionally trip a classifier on wording alone.
 */
const FALLBACK_BETA = 'server-side-fallback-2026-07-01';

let client: Anthropic | null = null;

export function isAiConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

function getClient(): Anthropic | null {
  if (!isAiConfigured()) return null;
  if (!client) {
    client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return client;
}

export class AiUnavailableError extends Error {
  readonly reason: 'not_configured' | 'refused' | 'rate_limited' | 'upstream';

  constructor(reason: AiUnavailableError['reason'], message: string) {
    super(message);
    this.name = 'AiUnavailableError';
    this.reason = reason;
  }
}

/** Maps SDK failures onto a small set of outcomes callers can act on. */
function toAiError(error: unknown): AiUnavailableError {
  if (error instanceof Anthropic.RateLimitError) {
    return new AiUnavailableError('rate_limited', 'AI is busy right now. Try again shortly.');
  }
  if (error instanceof Anthropic.APIError) {
    logger.error('Claude API error', { status: error.status, message: error.message });
    return new AiUnavailableError('upstream', 'AI service is unavailable.');
  }
  logger.error('Claude call failed', {
    error: error instanceof Error ? error.message : 'Unknown error',
  });
  return new AiUnavailableError('upstream', 'AI service is unavailable.');
}

function firstText(content: Anthropic.Messages.ContentBlock[]): string {
  for (const block of content) {
    if (block.type === 'text') return block.text;
  }
  return '';
}

// ---------------------------------------------------------------------------
// Expense categorization
// ---------------------------------------------------------------------------

export interface CategorySuggestion {
  category: string;
  confidence: number;
  reasoning: string;
}

const CATEGORY_SCHEMA = {
  type: 'object',
  properties: {
    category: {
      type: 'string',
      description: 'The single best-fitting category, chosen from the allowed list.',
    },
    confidence: {
      type: 'number',
      description: 'How confident this categorization is, from 0 to 1.',
    },
    reasoning: {
      type: 'string',
      description: 'One short sentence explaining the choice, shown to the user.',
    },
  },
  required: ['category', 'confidence', 'reasoning'],
  additionalProperties: false,
} as const;

/**
 * Suggests a category for an expense from its merchant name and amount.
 *
 * The allowed categories are passed in rather than hardcoded so the suggestion
 * can only ever be one the app already knows how to store - a free-text
 * category would create rows no filter or chart could group.
 */
export async function suggestExpenseCategory(params: {
  name: string;
  amount: number;
  description?: string;
  allowedCategories: string[];
}): Promise<CategorySuggestion> {
  const anthropic = getClient();
  if (!anthropic) {
    throw new AiUnavailableError('not_configured', 'AI categorization is not configured.');
  }

  const { name, amount, description, allowedCategories } = params;

  try {
    const response = await anthropic.beta.messages.create({
      model: MODEL,
      max_tokens: 1024,
      betas: [FALLBACK_BETA],
      fallbacks: 'default',
      output_config: {
        format: { type: 'json_schema', schema: CATEGORY_SCHEMA },
        effort: 'low',
      },
      system:
        'You categorize personal financial transactions. Choose exactly one category from the allowed list. ' +
        'If the merchant is ambiguous, pick the most probable category and lower the confidence rather than guessing wildly. ' +
        'Keep the reasoning to one short sentence a user would find useful.',
      messages: [
        {
          role: 'user',
          content: [
            `Allowed categories: ${allowedCategories.join(', ')}`,
            `Merchant / description: ${name}`,
            description ? `Note: ${description}` : '',
            `Amount: ${amount}`,
          ]
            .filter(Boolean)
            .join('\n'),
        },
      ],
    });

    if (response.stop_reason === 'refusal') {
      throw new AiUnavailableError('refused', 'AI declined to categorize this expense.');
    }

    const parsed = JSON.parse(firstText(response.content as Anthropic.Messages.ContentBlock[])) as CategorySuggestion;

    // The schema constrains the shape, not the values - a category outside the
    // allowed list would produce an expense no view can group.
    if (!allowedCategories.includes(parsed.category)) {
      throw new AiUnavailableError('upstream', 'AI returned an unknown category.');
    }

    return {
      category: parsed.category,
      confidence: Math.max(0, Math.min(1, Number(parsed.confidence) || 0)),
      reasoning: String(parsed.reasoning || ''),
    };
  } catch (error) {
    if (error instanceof AiUnavailableError) throw error;
    throw toAiError(error);
  }
}

// ---------------------------------------------------------------------------
// Spending insights
// ---------------------------------------------------------------------------

export interface SpendingInsight {
  headline: string;
  observations: string[];
  suggestion: string;
}

const INSIGHT_SCHEMA = {
  type: 'object',
  properties: {
    headline: {
      type: 'string',
      description: 'One sentence summarizing the month, stated plainly.',
    },
    observations: {
      type: 'array',
      items: { type: 'string' },
      description: 'Two to four specific observations, each citing a real figure from the data.',
    },
    suggestion: {
      type: 'string',
      description: 'One concrete, actionable suggestion grounded in the data.',
    },
  },
  required: ['headline', 'observations', 'suggestion'],
  additionalProperties: false,
} as const;

export interface SpendingFacts {
  currency: string;
  totalThisMonth: number;
  totalLastMonth: number;
  avgMonthly6: number;
  elapsedDays: number;
  topCategories: Array<{ category: string; total: number }>;
  budgets: Array<{ name: string; limit: number; spent: number }>;
}

/**
 * Turns pre-computed spending aggregates into a short written summary.
 *
 * The model is given figures, never raw transactions: it summarizes numbers the
 * backend already computed rather than doing arithmetic itself, so an insight
 * can't contradict the dashboard beside it. The prompt says so explicitly,
 * because a plausible-but-invented figure is the failure mode that matters on a
 * finance screen.
 */
export async function generateSpendingInsight(facts: SpendingFacts): Promise<SpendingInsight> {
  const anthropic = getClient();
  if (!anthropic) {
    throw new AiUnavailableError('not_configured', 'AI insights are not configured.');
  }

  try {
    const response = await anthropic.beta.messages.create({
      model: MODEL,
      max_tokens: 2048,
      betas: [FALLBACK_BETA],
      fallbacks: 'default',
      output_config: {
        format: { type: 'json_schema', schema: INSIGHT_SCHEMA },
        effort: 'medium',
      },
      system:
        'You write short, factual summaries of a person\'s spending for a personal finance dashboard.\n' +
        'Use ONLY the figures provided. Never invent, estimate, or extrapolate a number that is not given ' +
        'to you - the same figures are displayed next to your summary, and a number that disagrees with them ' +
        'destroys the user\'s trust in both.\n' +
        'Do not moralize or lecture about spending choices. Be specific and useful.\n' +
        'If the data is too sparse to say anything meaningful, say that plainly instead of padding.',
      messages: [
        {
          role: 'user',
          content: JSON.stringify(facts, null, 2),
        },
      ],
    });

    if (response.stop_reason === 'refusal') {
      throw new AiUnavailableError('refused', 'AI declined to summarize this data.');
    }

    const parsed = JSON.parse(firstText(response.content as Anthropic.Messages.ContentBlock[])) as SpendingInsight;

    return {
      headline: String(parsed.headline || ''),
      observations: Array.isArray(parsed.observations) ? parsed.observations.map(String) : [],
      suggestion: String(parsed.suggestion || ''),
    };
  } catch (error) {
    if (error instanceof AiUnavailableError) throw error;
    throw toAiError(error);
  }
}
