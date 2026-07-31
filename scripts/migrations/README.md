# Data migrations

One-off scripts that have been run against Firestore. Kept for the record —
each one names what it changed, when, and how it was verified.

They read credentials from `backend/.env` via firebase-admin and default to a
dry run; pass `--apply` to write.

## 2026-07-31 — normalize `expenses.date`

**Problem.** `expenses.date` held three different types depending on when the
row was written: ISO strings (47), Firestore Timestamps (75), and bare calendar
dates (3). Firestore orders values by type before value, so a string range
query cannot match a Timestamp field — the rows are not merely excluded from
the range, they are invisible to it.

Every date-filtered query in the backend uses ISO string bounds
(`getExpenseAnalytics`, and the `startDate`/`endDate` filters in
`getAllExpenses`), so accounts whose rows were Timestamps returned nothing at
all. Two of six accounts were 100% Timestamps and their analytics were
permanently empty; a third silently lost 18 of 38 rows.

The write path already normalizes to ISO (`normalizeIsoDate` in
`expenses.ts`), so the Timestamps were legacy data, not something still being
produced.

**Change.** Rewrote all 78 non-ISO rows to ISO strings. Instants are preserved
exactly — only the stored type changes. Bare calendar dates are anchored at
12:00 UTC so they cannot drift across a day boundary in either direction.

**Verified.** Before: a string-range query over 2025 returned 0 rows for the two
Timestamp-only accounts. After: 25 rows / $6,850.24 and 32 rows / $7,867.43,
matching a full-collection reduce. All 125 documents are now a single type, and
a rollback record of every previous value was written before any mutation.
