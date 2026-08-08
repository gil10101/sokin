/**
 * Security Rules Structure Tests
 *
 * firestore.rules and storage.rules decide who can read a stranger's expenses
 * and nothing in CI executes them: `firebase deploy` only checks that they
 * parse, and the rules emulator needs a JVM this project does not carry. So
 * the two mistakes that have actually shipped here are checked structurally
 * instead.
 *
 * 1. Shadowed validation. Rules are OR-ed and `write` covers create, update
 *    and delete. A `allow read, write: if isOwner(uid)` sitting beside a
 *    carefully validated `allow create` satisfies every write on its own, so
 *    the validation never runs - and the file still reads as if it does.
 *
 * 2. An update rule that only inspects the incoming document. Checking
 *    `request.resource.data.userId` alone lets any signed-in user overwrite
 *    another user's document by stamping their own id onto the replacement;
 *    only `resource.data.userId` says whose document is being replaced.
 *
 * These are text-level assertions, not behavioural ones. They cannot prove a
 * rule permits the right things - they exist to stop two specific regressions
 * that syntax checking is blind to.
 */

import fs from 'fs';
import path from 'path';

const REPO_ROOT = path.resolve(__dirname, '../../../..');
const FIRESTORE_RULES = path.join(REPO_ROOT, 'firestore.rules');
const STORAGE_RULES = path.join(REPO_ROOT, 'storage.rules');

interface AllowClause {
  /** The match paths enclosing this clause, outermost first */
  scope: string[];
  /** Operations granted, e.g. ['read', 'write'] */
  operations: string[];
  /** The condition text following `if` */
  condition: string;
}

/**
 * Walks a rules file and returns every `allow` clause with the match paths it
 * sits inside. Conditions routinely span several lines, so text is joined
 * until the terminating semicolon.
 */
const parseAllowClauses = (source: string): AllowClause[] => {
  // Strip comments so `//` prose and /* */ blocks cannot be read as rules.
  const cleaned = source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/[^\n]*/g, '');

  const clauses: AllowClause[] = [];
  // Each entry records the brace depth the match was opened at, so helper
  // function bodies and the service preamble cannot pop a match off the stack.
  const scope: Array<{ path: string; depth: number }> = [];
  const paths = (): string[] => scope.map((entry) => entry.path);
  const netBraces = (line: string): number =>
    (line.match(/\{/g) || []).length - (line.match(/\}/g) || []).length;

  let depth = 0;
  let pending: string | null = null;

  for (const rawLine of cleaned.split('\n')) {
    const line = rawLine.trim();
    if (!line) continue;

    if (pending !== null) {
      pending += ' ' + line;
      if (line.includes(';')) {
        clauses.push(toClause(pending, paths()));
        pending = null;
      }
      continue;
    }

    const matchStart = line.match(/^match\s+(\S+)\s*\{/);
    if (matchStart) {
      scope.push({ path: matchStart[1], depth });
      depth += netBraces(line);
      continue;
    }

    if (line.startsWith('allow')) {
      if (line.includes(';')) {
        clauses.push(toClause(line, paths()));
      } else {
        pending = line;
      }
      continue;
    }

    depth += netBraces(line);
    while (scope.length > 0 && scope[scope.length - 1].depth >= depth) {
      scope.pop();
    }
  }

  return clauses;
};

const toClause = (text: string, scope: string[]): AllowClause => {
  const match = text.match(/^allow\s+([^:]+):\s*if\s+([\s\S]*?);\s*$/);
  if (!match) {
    throw new Error(`Unparseable allow clause: ${text}`);
  }
  return {
    scope,
    operations: match[1].split(',').map((op) => op.trim()),
    condition: match[2].replace(/\s+/g, ' ').trim(),
  };
};

const scopeKey = (clause: AllowClause): string => clause.scope.join('');

const firestoreClauses = parseAllowClauses(fs.readFileSync(FIRESTORE_RULES, 'utf8'));
const storageClauses = parseAllowClauses(fs.readFileSync(STORAGE_RULES, 'utf8'));

describe('security rules parsing', () => {
  it('reads a plausible number of rules out of both files', () => {
    // Guards the parser itself: if it silently matched nothing, every
    // assertion below would pass vacuously.
    expect(firestoreClauses.length).toBeGreaterThan(20);
    expect(storageClauses.length).toBeGreaterThan(5);
    expect(firestoreClauses.every((c) => c.scope.length > 0)).toBe(true);
  });
});

describe.each([
  ['firestore.rules', firestoreClauses],
  ['storage.rules', storageClauses],
])('%s', (_name, clauses) => {
  it('never places a blanket write beside a validated create or update', () => {
    const byScope = new Map<string, AllowClause[]>();
    for (const clause of clauses) {
      const key = scopeKey(clause);
      byScope.set(key, [...(byScope.get(key) || []), clause]);
    }

    const shadowed: string[] = [];
    for (const [key, scoped] of byScope) {
      const hasBlanketWrite = scoped.some(
        (c) => c.operations.includes('write') && c.condition !== 'false'
      );
      const hasValidatedWrite = scoped.some((c) =>
        c.operations.some((op) => op === 'create' || op === 'update')
      );
      if (hasBlanketWrite && hasValidatedWrite) {
        shadowed.push(key);
      }
    }

    expect(shadowed).toEqual([]);
  });

  it('grants nothing unconditionally except explicitly public reads', () => {
    const unconditional = clauses.filter(
      (c) => c.condition === 'true' && !scopeKey(c).includes('/public/')
    );

    expect(unconditional).toEqual([]);
  });

  it('requires an authenticated caller on every grant that is not a hard deny', () => {
    const anonymous = clauses.filter(
      (c) =>
        c.condition !== 'false' &&
        !c.condition.includes('request.auth') &&
        !c.condition.includes('isAuthenticated()') &&
        !c.condition.includes('isOwner(') &&
        !scopeKey(c).includes('/public/')
    );

    expect(anonymous).toEqual([]);
  });
});

describe('firestore.rules ownership on updates', () => {
  it('checks the stored document, not only the incoming one', () => {
    // `request.resource.data.userId` is the document the caller is trying to
    // write. On its own it proves nothing about who owns what is already
    // there, which is the whole question on an update.
    const offenders = firestoreClauses
      .filter((c) => c.operations.includes('update'))
      .filter((c) => {
        // Paths keyed by {userId} are owned by their own document id, so
        // isOwner(userId) already answers this.
        if (scopeKey(c).includes('{userId}')) return false;

        const withoutIncoming = c.condition.replace(/request\.resource/g, 'INCOMING');
        const inspectsIncomingOwner = c.condition.includes('request.resource.data.userId');
        const inspectsStoredOwner = withoutIncoming.includes('resource.data.userId');

        return inspectsIncomingOwner && !inspectsStoredOwner;
      })
      .map((c) => scopeKey(c));

    expect(offenders).toEqual([]);
  });

  it('covers every collection that carries a userId with an update rule that checks it', () => {
    // Named so a new money-bearing collection added without an ownership
    // check on update shows up here rather than in an incident.
    const updateScopes = firestoreClauses
      .filter((c) => c.operations.includes('update'))
      .map(scopeKey);

    const moneyCollections = [
      '/databases/{database}/documents/expenses/{expenseId}',
      '/databases/{database}/documents/budgets/{budgetId}',
      '/databases/{database}/documents/goals/{goalId}',
      '/databases/{database}/documents/stockTransactions/{transactionId}',
      '/databases/{database}/documents/assets/{assetId}',
      '/databases/{database}/documents/liabilities/{liabilityId}',
      '/databases/{database}/documents/incomes/{incomeId}',
      '/databases/{database}/documents/netWorthSnapshots/{snapshotId}',
      '/databases/{database}/documents/billReminders/{billId}',
      '/databases/{database}/documents/subscriptions/{subscriptionId}',
      '/databases/{database}/documents/predictions/{predictionId}',
    ];

    for (const collection of moneyCollections) {
      expect(updateScopes).toContain(collection);

      const clause = firestoreClauses.find(
        (c) => c.operations.includes('update') && scopeKey(c) === collection
      );
      const withoutIncoming = clause!.condition.replace(/request\.resource/g, 'INCOMING');
      expect(withoutIncoming).toContain('resource.data.userId');
    }
  });
});

describe('storage.rules upload constraints', () => {
  it.each([
    ['/receipts/{userId}/{allPaths=**}'],
    ['/profile-images/{userId}/{allPaths=**}'],
  ])('bounds size and content type on every write to %s', (folder) => {
    const writes = storageClauses.filter(
      (c) =>
        scopeKey(c).includes(folder) &&
        c.operations.some((op) => op === 'create' || op === 'update' || op === 'write')
    );

    expect(writes.length).toBeGreaterThan(0);

    for (const clause of writes) {
      expect(clause.condition).toContain('request.resource.size');
      expect(clause.condition).toContain('request.resource.contentType');
    }
  });
});
