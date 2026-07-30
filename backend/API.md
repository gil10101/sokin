# Sokin API

All endpoints are mounted under `/api` and require a Firebase ID token:

```
Authorization: Bearer <firebase-id-token>
```

Responses are wrapped as `{ success, data }`; list endpoints that paginate add
`pagination: { count, limit, nextCursor, hasMore }`. Errors return
`{ success: false, error }`.

`GET /health` is public and returns `{ status, timestamp }`.

## Expenses

| Method | Path |
|---|---|
| GET | `/api/expenses` |
| GET | `/api/expenses/analytics` |
| GET | `/api/expenses/:id` |
| POST | `/api/expenses` |
| PUT | `/api/expenses/:id` |
| DELETE | `/api/expenses/:id` |

## Users & profile

| Method | Path |
|---|---|
| GET | `/api/users/profile` |
| PUT | `/api/users/profile` |
| POST | `/api/users` |
| GET | `/api/users/:userId` |
| PUT | `/api/users/:userId` |
| GET | `/api/users/:userId/categories` |
| PUT | `/api/users/:userId/categories` |

## Budgets

| Method | Path |
|---|---|
| GET | `/api/budgets` |
| GET | `/api/budgets/:id` |
| POST | `/api/budgets` |
| PUT | `/api/budgets/:id` |
| DELETE | `/api/budgets/:id` |

## Receipts

| Method | Path |
|---|---|
| POST | `/api/receipts/process` |

## Notifications

| Method | Path |
|---|---|
| GET | `/api/notifications` |
| POST | `/api/notifications` |
| PATCH | `/api/notifications/:notificationId/read` |
| PATCH | `/api/notifications/read-all` |
| PATCH | `/api/notifications/:notificationId/dismiss` |
| PATCH | `/api/notifications/dismiss-all` |
| DELETE | `/api/notifications/:notificationId` |
| PUT | `/api/notifications/preferences` |
| GET | `/api/notifications/preferences` |
| POST | `/api/notifications/fcm-token` |
| POST | `/api/notifications/check-budget-alerts` |
| GET | `/api/notifications/check-budget-alerts` |

## Savings goals

| Method | Path |
|---|---|
| GET | `/api/goals` |
| POST | `/api/goals` |
| POST | `/api/goals/:goalId/contribute` |
| PUT | `/api/goals/:goalId` |
| DELETE | `/api/goals/:goalId` |

## Bill reminders

| Method | Path |
|---|---|
| GET | `/api/bill-reminders` |
| POST | `/api/bill-reminders` |
| POST | `/api/bill-reminders/:billId/pay` |
| PUT | `/api/bill-reminders/:billId` |
| DELETE | `/api/bill-reminders/:billId` |

## Stocks

| Method | Path |
|---|---|
| GET | `/api/stocks/market-indices` |
| GET | `/api/stocks/trending` |
| GET | `/api/stocks/search` |
| GET | `/api/stocks/stock/:symbol` |
| GET | `/api/stocks/portfolio` |
| POST | `/api/stocks/transaction` |
| GET | `/api/stocks/max-sell/:symbol` |
| GET | `/api/stocks/transactions` |
| GET | `/api/stocks/watchlist` |
| POST | `/api/stocks/watchlist` |
| PUT | `/api/stocks/watchlist` |
| DELETE | `/api/stocks/watchlist/:symbol` |

## Net worth

| Method | Path |
|---|---|
| GET | `/api/net-worth/assets` |
| POST | `/api/net-worth/assets` |
| PUT | `/api/net-worth/assets/:id` |
| DELETE | `/api/net-worth/assets/:id` |
| GET | `/api/net-worth/liabilities` |
| POST | `/api/net-worth/liabilities` |
| PUT | `/api/net-worth/liabilities/:id` |
| DELETE | `/api/net-worth/liabilities/:id` |
| GET | `/api/net-worth/calculate` |
| GET | `/api/net-worth/history` |
| GET | `/api/net-worth/trends` |
| GET | `/api/net-worth/insights` |

## Dashboard

| Method | Path |
|---|---|
| GET | `/api/dashboard` |

## Subscriptions

| Method | Path |
|---|---|
| GET | `/api/subscriptions` |
| POST | `/api/subscriptions` |
| PUT | `/api/subscriptions/:id` |
| DELETE | `/api/subscriptions/:id` |

---

70 routes generated from `backend/src/routes/`.
