# Sokin Backend

Express + TypeScript API for Sokin. Firebase Auth + Firestore. Finnhub for stocks.

## Quick start

1. Create `backend/.env` (see `SETUP.md`).
2. `npm install`
3. `npm run dev`

## Scripts

- `npm run dev` - hot reload
- `npm run build`
- `npm start`
- `npm run lint`
- `npm test`

## Auth

Send `Authorization: Bearer <firebase-id-token>` (except `/health` and public stock endpoints).

## Docs

- Setup: `SETUP.md`
- API: `API.md`
- Developer guide: `DEVELOPER.md`