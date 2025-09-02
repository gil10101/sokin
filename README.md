# Sokin - Expense Tracker

## Project Overview

Sokin is a comprehensive expense tracking application with separate frontend and backend components. The frontend is built with Next.js, and the backend is an Express API.

## Firebase Setup

The application uses Firebase for authentication and database functionality. To set up Firebase:

1. Create a Firebase project at [Firebase Console](https://console.firebase.google.com/)
2. Enable Authentication with Email/Password
3. Set up Firestore Database
4. Get your Firebase configuration values:
   - Go to Project Settings
   - Scroll down to "Your apps" section
   - Select your web app (or create one if needed)
   - Copy the configuration values

5. Update the `frontend/.env.local` file with your Firebase configuration values:
   ```
   NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key_here
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_auth_domain_here
   NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id_here
   NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_storage_bucket_here
   NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id_here
   NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id_here
   
   # Backend API URL (important for frontend-backend communication)
   # Replace with your actual backend URL (e.g., http://localhost:5001/api for local development)
   NEXT_PUBLIC_API_URL=http://localhost:5001/api
   
   # Optional Sentry configuration (for error tracking)
   NEXT_PUBLIC_SENTRY_DSN=your_sentry_dsn_here

   # Performance Monitor (not recommended for production)
   # Set to 'true' to enable the performance monitor overlay
   NEXT_PUBLIC_ENABLE_PERFORMANCE_MONITOR=false
   ```

6. For backend Firebase Admin SDK setup, create a service account:
   - Go to Project Settings > Service Accounts
   - Generate a new private key
   - Save the JSON file securely
   - Add the contents to your `backend/.env` file as:
   ```
   FIREBASE_SERVICE_ACCOUNT='{"type":"service_account","project_id":"...","private_key_id":"...","private_key":"...","client_email":"...","client_id":"...","auth_uri":"...","token_uri":"...","auth_provider_x509_cert_url":"...","client_x509_cert_url":"..."}'
   FIREBASE_PROJECT_ID=your_project_id_here
   NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_storage_bucket_here
   PORT=5001
   ```

7. Restart your development server after updating the environment files

## Development

```bash
# Install all dependencies (frontend, backend, and root)
npm install

# Start both frontend and backend development servers
npm run dev

# Start only frontend development server
npm run dev:frontend

# Start only backend development server
npm run dev:backend
```

## Project Structure

```
sokin/
├── frontend/                      # Frontend application
│   ├── src/                       # Source code
│   │   ├── app/                   # Next.js app directory
│   │   │   ├── dashboard/         # Dashboard pages
│   │   │   ├── login/             # Login page
│   │   │   ├── signup/            # Signup page
│   │   │   ├── _not-found/        # 404 page
│   │   │   ├── globals.css        # Global styles
│   │   │   ├── layout.tsx         # Root layout
│   │   │   ├── not-found.tsx      # Not found page
│   │   │   └── page.tsx           # Home page
│   │   ├── components/            # React components
│   │   │   ├── dashboard/         # Dashboard components
│   │   │   ├── notifications/     # Notification components
│   │   │   ├── ui/                # UI components
│   │   │   ├── app-initializer.tsx # App initialization and checks
│   │   │   ├── error-boundary.tsx  # Error boundary for React errors
│   │   │   ├── protected-route.tsx # Authentication protection
│   │   │   └── theme-provider.tsx  # Theme provider
│   │   ├── contexts/              # React contexts
│   │   │   ├── auth-context.tsx         # Authentication context
│   │   │   └── notifications.tsx        # Notifications context
│   │   ├── hooks/                 # Custom React hooks
│   │   │   ├── useApi.ts          # Hook for API requests
│   │   │   ├── use-mobile.tsx     # Hook for mobile device detection
│   │   │   └── use-toast.ts       # Hook for toast notifications
│   │   ├── lib/                   # Utility functions and libraries
│   │   │   ├── api.ts             # API client
│   │   │   ├── api-utils.ts       # API utilities
│   │   │   ├── firebase.ts        # Firebase configuration
│   │   │   ├── firebase-messenger.ts # Firebase messaging utilities
│   │   │   ├── sentry.ts          # Error tracking
│   │   │   ├── types.ts           # TypeScript types
│   │   │   └── utils.ts           # General utility functions
│   │   ├── pages/                 # Page for debuging
│   │   ├── contexts/              # React contexts
│   │   └── styles/                # Additional styles
│   ├── public/                    # Static assets
│   ├── .env.local                 # Frontend environment variables
│   ├── components.json            # Component configuration
│   ├── next.config.mjs            # Next.js configuration
│   ├── package.json               # Frontend dependencies
│   ├── postcss.config.mjs         # PostCSS configuration
│   ├── tailwind.config.ts         # Tailwind CSS configuration
│   └── tsconfig.json              # TypeScript configuration
├── backend/                       # Backend application
│   ├── src/                       # Source code
│   │   ├── config/                # Configuration files
│   │   │   └── firebase.ts        # Firebase Admin configuration
│   │   ├── controllers/           # Route controllers
│   │   │   ├── billReminder.js            # Bill reminder controller
│   │   │   ├── budgets.js                 # Budget controllers
│   │   │   ├── expenses.js                # Expense controllers
│   │   │   ├── goalsController.js         # Goals controller
│   │   │   ├── notificationController.js  # Notification controller
│   │   │   ├── recepitController.js       # Receipt controller
│   │   │   └── users.js                   # User controller
│   │   ├── middleware/            # Express middleware
│   │   │   └── auth.ts            # Authentication middleware
│   │   ├── models/                # Data models
│   │   │   ├── schemas.js         # Data validation schemas
│   │   │   └── types.js           # Data model type definitions
│   │   ├── routes/                # API routes
│   │   │   ├── expenses.js            # Expense routes
│   │   │   ├── users.js               # User routes
│   │   │   ├── budgets.js             # Budget routes
│   │   │   ├── billRemindersRoutes.js       # Bill reminders routes
│   │   │   ├── goalsRoutes.js               # Goals routes
│   │   │   ├── notificationRoutes.js        # Notification routes
│   │   │   └── receipt.js             # Receipt routes
│   │   ├── types/                 # Type definitions
│   │   │   └── express/           # Express-specific types
│   │   ├── utils/                 # Utility functions
│   │   └── index.ts               # Entry point
│   ├── .env                       # Backend environment variables
│   ├── package.json               # Backend dependencies
│   └── tsconfig.json              # TypeScript configuration
├── functions/                     # Cloud Functions or serverless functions
├── lib/                           # Shared libraries and utilities
├── package.json                   # Root package.json with workspace setup
├── .firebaserc                    # Firebase project configuration
├── firebase.json                  # Firebase service and hosting configuration
├── firestore.indexes.json         # Firestore indexes configuration
└── firestore.rules                # Firestore security rules
```

## Features and Improvements

### Frontend
- **API Client**: Robust API client with automatic authentication and error handling
- **Error Tracking**: Sentry integration for real-time error tracking with user identification
- **Error Boundaries**: React error boundaries to prevent app crashes
- **Backend Connectivity Monitoring**: Automatic health checks with toast notifications for connection issues
- **Configuration Validation**: Environment variable validation utilities
- **TypeScript Types**: Comprehensive TypeScript type definitions for API data
- **Firebase Messaging**: Push notification support with FCM token management
- **Custom Hooks**: API interaction hooks and mobile-responsive utilities
- **Protected Routes**: Authentication-based route protection
- **Theme Support**: Dark/light theme provider integration

### Backend
- **Secure Authentication**: Firebase Admin authentication with token verification middleware
- **Controller Architecture**: Well-structured MVC pattern with dedicated controllers for expenses, budgets, users, notifications, goals, receipts, and bill reminders
- **Rate Limiting**: Request rate limiting middleware to prevent abuse
- **Input Validation**: Request validation middleware with error handling
- **Error Handling**: Comprehensive error handling middleware with structured logging
- **Security Headers**: Helmet integration for secure HTTP headers and CORS configuration
- **Health Monitoring**: Health check endpoint for connectivity monitoring
- **Logging**: Structured logging utility for debugging and monitoring
- **Caching**: Caching utilities for improved performance

## Troubleshooting

### Error: Firebase: Error (auth/invalid-api-key)

If you're seeing this error, it means your Firebase API key is either missing or invalid. Make sure you've:
1. Created the `frontend/.env.local` file
2. Added the correct API key from your Firebase project
3. Restarted your development server

### Error: Backend API Not Reachable

If the app shows "Connection Issue" notifications:
1. Ensure the backend server is running (`npm run dev:backend`)
2. Check that the `NEXT_PUBLIC_API_URL` is set correctly in your frontend environment variables
3. Verify that the port specified in your backend `.env` file matches the port in the API URL

### Error: Unauthorized Access

If you're seeing authentication errors when accessing API endpoints:
1. Make sure you're signed in to the application
2. Check that your Firebase configuration is correct in both frontend and backend
3. Verify that the Firebase service account has the necessary permissions 