# Backend setup

## Prereqs

- Node.js 20+
- npm
- Firebase project (Auth + Firestore)
- Finnhub API key

## Env

Create `backend/.env`:

```bash
FIREBASE_PROJECT_ID=your-firebase-project-id
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com
FINNHUB_API_KEY=your-finnhub-api-key
PORT=5001
NODE_ENV=development
CORS_ORIGIN=http://localhost:3000

# Optional
CRON_SECRET=your-cron-secret-minimum-32-characters-long
UPSTASH_REDIS_REST_URL=https://your-redis.upstash.io
UPSTASH_REDIS_REST_TOKEN=your-upstash-token
```

## Firebase credentials

1. Firebase Console → Project Settings → Service Accounts
2. Generate a new private key
3. Map values:
   - `project_id` → `FIREBASE_PROJECT_ID`
   - `private_key` → `FIREBASE_PRIVATE_KEY` (keep `\n`)
   - `client_email` → `FIREBASE_CLIENT_EMAIL`

## Local dev

```bash
cd backend
npm install
npm run dev
```

API: `http://localhost:5001`

## Tests

```bash
npm test
npm run test:watch
npm run test:coverage
npm run test:ci
```

## Firestore indexes

- `expenses`: `userId` (asc) + `date` (desc)
- `expenses`: `userId` (asc) + `category` (asc) + `date` (desc)
- `portfolios`: `userId` (asc) + `updatedAt` (desc)
- `stockTransactions`: `userId` (asc) + `transactionDate` (desc)

Deploy rules when needed:

```bash
firebase deploy --only firestore:rules
```

## Deploy

Vercel:

```bash
npm run deploy-preview
npm run deploy
```

Set all env vars in Vercel for Preview + Production.

CI/CD workflow: `.github/workflows/backend-ci-cd.yml`

Required secrets: `FINNHUB_API_KEY`, `FIREBASE_PROJECT_ID`, `FIREBASE_PRIVATE_KEY`, `FIREBASE_CLIENT_EMAIL`, `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`. Optional: `CODECOV_TOKEN`.

## Troubleshooting

- **Firebase auth not initialized**: check Firebase env vars and private key formatting.
- **Finnhub errors**: verify `FINNHUB_API_KEY` and free-tier rate limits.
