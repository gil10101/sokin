# Sokin

Personal finance app covering expenses, budgets, savings goals, net worth, bill
reminders, subscriptions, receipts, and stock tracking.

![Dashboard](portfolio-assets/dashboard.png)

## Stack

| Layer | Choice |
|---|---|
| Frontend | Next.js 16 (App Router), React 19, TypeScript, Tailwind, Radix, Recharts |
| Backend | Express + TypeScript on Vercel serverless |
| Data | Firestore, Firebase Auth, Firebase Storage |
| Cache | Upstash Redis (REST) with an in-process tier |
| Market data | Finnhub |
| OCR | Google Cloud Vision |

## Quick start

```bash
npm install
npm run dev            # frontend on :3000, API on :5001
```

Environment:

- `frontend/.env.local` — Firebase web config plus `NEXT_PUBLIC_API_URL`
- `backend/.env` — Firebase Admin credentials, `FINNHUB_API_KEY`,
  `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `CORS_ORIGIN`,
  `CRON_SECRET`

Full backend setup lives in [`backend/SETUP.md`](backend/SETUP.md); the route
list is in [`backend/API.md`](backend/API.md).

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Frontend + API together |
| `npm run dev:frontend` / `npm run dev:backend` | One side only |
| `npm run build` | Build both workspaces |
| `npm run lint` | ESLint across workspaces |
| `npm test --workspace=backend` | Jest suite |

## How it works

The Next.js client authenticates with Firebase Auth and sends the resulting ID
token on every API call. Express verifies it with the Admin SDK and scopes each
query to that user; nothing reads Firestore directly from the browser. Reads go
through a two-tier cache (in-process, then Upstash) with per-resource TTLs, and
writes invalidate the affected key patterns.

Stock quotes come from Finnhub behind that same cache — 30s for quotes, an hour
for company profiles and 52-week metrics — with batched requests so a portfolio
refresh stays inside the free tier. Receipts are uploaded to Firebase Storage,
read by Cloud Vision, and parsed into a categorized expense the user confirms.

Rate limiting uses an atomic Redis counter so every serverless instance shares
one window, and falls back to per-instance metering rather than opening up if
Redis is unreachable.

## Screenshots

| | |
|---|---|
| ![Expenses](portfolio-assets/expenses.png) | ![Net worth](portfolio-assets/goals-networth.png) |

## License

MIT — see [LICENSE](LICENSE).
