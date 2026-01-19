# Sokin

Expense tracker built with Next.js, Express, and Firebase.

## Overview

Sokin is a personal finance app that covers expenses, budgets, goals, net worth, bill reminders, notifications, receipts, and stock tracking. The frontend is a Next.js dashboard that talks to a Firebase‑authenticated Express API backed by Firestore. Stock data comes from Finnhub, with caching and rate limiting on the API.

## Stack

- Frontend: Next.js (App Router), TypeScript
- Backend: Express + TypeScript
- Data/Auth: Firestore + Firebase Auth
- Integrations: Finnhub (stocks), WebSocket for live prices

## Quick start

```bash
npm install
npm run dev
```

## Env

- `frontend/.env.local`: Firebase client config + `NEXT_PUBLIC_API_URL`
- `backend/.env`: Firebase Admin + Finnhub key

Full backend setup: `backend/SETUP.md`.

## Useful scripts

- `npm run dev` - frontend + backend
- `npm run dev:frontend`
- `npm run dev:backend`

## Docs

- Backend setup: `backend/SETUP.md`
- Backend API: `backend/API.md`