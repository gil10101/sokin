# Sokin Backend API

Auth: Firebase ID token in `Authorization: Bearer <firebase-id-token>`. All endpoints require auth unless marked Public. `/health` is public.

## Rate limits

| Endpoint type | Limit | Window |
| --- | --- | --- |
| Read operations | 200 requests | 15 minutes |
| Write operations | 100 requests | 15 minutes |
| Auth operations | 20 requests | 15 minutes |
| Stock API | 100 requests | 1 minute |
| Sensitive operations | 3 requests | 1 hour |

## Errors

```json
{
  "success": false,
  "error": "Human-readable error message",
  "code": "ERROR_CODE",
  "details": {}
}
```

## Endpoints

### Health

- `GET /health` (Public)

### Users

- `POST /users` - create profile
- `GET /users/:userId`
- `PUT /users/:userId`
- `GET /users/:userId/categories`
- `PUT /users/:userId/categories`

### Expenses

- `GET /expenses` - query: `limit`, `cursor`, `startDate`, `endDate`, `category`
- `GET /expenses/:id`
- `POST /expenses`
- `PUT /expenses/:id`
- `DELETE /expenses/:id`
- `GET /expenses/analytics` - query: `timeframe` (3months | 6months | 12months)

### Budgets

- `GET /budgets`
- `POST /budgets`
- `PUT /budgets/:id`
- `DELETE /budgets/:id`

### Stocks

- `GET /stocks/market-indices` (Public)
- `GET /stocks/trending` (Public) - query: `limit`
- `GET /stocks/search` (Public) - query: `q`, `limit`
- `GET /stocks/stock/:symbol` (Public)
- `GET /stocks/portfolio/:userId`
- `POST /stocks/transaction`
- `GET /stocks/max-sell/:symbol`
- `GET /stocks/transactions` - query: `limit`

### Bill Reminders

- `GET /bill-reminders`
- `POST /bill-reminders`
- `PUT /bill-reminders/:id`
- `DELETE /bill-reminders/:id`

### Goals

- `GET /goals`
- `POST /goals`
- `PUT /goals/:id`
- `DELETE /goals/:id`

### Net Worth

- `GET /net-worth/current`
- `POST /net-worth/assets`
- `POST /net-worth/liabilities`
- `GET /net-worth/history`

### Dashboard

- `GET /dashboard/summary`

### Notifications

- `GET /notifications`
- `PUT /notifications/:id/read`
- `PUT /notifications/read-all`

### Receipts

- `POST /receipts/scan` - `multipart/form-data` with image

## WebSocket (stocks)

```javascript
import { io } from 'socket.io-client';

const socket = io('wss://your-api-domain.vercel.app', {
  auth: { token: firebaseIdToken }
});
```

Client → server:

| Event | Payload |
| --- | --- |
| `subscribe_prices` | `{ symbols: ['AAPL', 'GOOGL'] }` |
| `unsubscribe_prices` | `{ symbols: ['AAPL'] }` |

Server → client:

| Event | Payload |
| --- | --- |
| `connected` | `{ status, authenticated }` |
| `price_updates` | `{ AAPL: { price, change, ... } }` |
| `subscribed` | `{ symbols, status }` |
| `error` | `{ message }` |

## Data source

Stock data uses Finnhub.
