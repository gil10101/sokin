# Sokin Backend API

Backend API service for the Sokin expense tracking application built with Node.js, Express, TypeScript, and Firebase.

## Features

- RESTful API endpoints for expenses, budgets, and user profiles
- Firebase Authentication for secure user access
- Firestore database for data storage
- Robust error handling and validation
- Caching layer for improved performance
- Rate limiting for API protection
- Comprehensive logging

## Prerequisites

- Node.js 18+ and npm
- Firebase project with Firestore and Authentication enabled
- Firebase service account credentials

## Environment Setup

1. Clone the repository
2. Copy `.env.example` to `.env` and fill in your Firebase configuration
3. Install dependencies:
   ```bash
   npm install
   ```

## Available Scripts

- `npm run dev` - Start development server with hot-reload
- `npm run build` - Build the TypeScript files to JavaScript
- `npm start` - Run the built application in production
- `npm run lint` - Run ESLint for code quality

## Project Structure

```
backend/
├── src/
│   ├── config/       # Application configuration
│   ├── controllers/  # Request handlers
│   ├── middleware/   # Express middleware
│   ├── models/       # Data models and validation schemas
│   ├── routes/       # API routes
│   ├── utils/        # Utility functions
│   └── index.ts      # Application entry point
├── .env.example      # Example environment variables
├── package.json      # Dependencies and scripts
└── tsconfig.json     # TypeScript configuration
```

## API Endpoints

### Expenses

- `GET /api/expenses` - Get all expenses for authenticated user
- `GET /api/expenses/:id` - Get a specific expense
- `POST /api/expenses` - Create a new expense
- `PUT /api/expenses/:id` - Update an expense
- `DELETE /api/expenses/:id` - Delete an expense

### Budgets

- `GET /api/budgets` - Get all budgets for authenticated user
- `GET /api/budgets/:id` - Get a specific budget
- `POST /api/budgets` - Create a new budget
- `PUT /api/budgets/:id` - Update a budget
- `DELETE /api/budgets/:id` - Delete a budget

### Users

- `GET /api/users/profile` - Get user profile
- `PUT /api/users/profile` - Update user profile

## Authentication

The API uses Firebase Authentication. Client applications should include the Firebase ID token in the Authorization header:

```
Authorization: Bearer <firebase-id-token>
```

## Error Handling

API responses follow a consistent format:

```json
// Success response
{
  "data": { ... },
  "message": "Optional success message"
}

// Error response
{
  "error": "Error message"
}
```

## Deployment

1. Build the application:
   ```bash
   npm run build
   ```

2. Deploy to your hosting platform of choice (Google Cloud, Heroku, etc.)

## Development Notes

- Use the validation middleware with Joi schemas for input validation
- Implement caching for frequently accessed data
- Add proper error handling with the AppError class and errorHandler middleware
- Utilize the logger utility for consistent logging 