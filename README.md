# Sokin - Expense Tracker

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

5. Update the `.env.local` file with your Firebase configuration values:
   ```
   NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key_here
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_auth_domain_here
   NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id_here
   NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_storage_bucket_here
   NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id_here
   NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id_here
   ```

6. Restart your development server after updating the `.env.local` file

## Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

## Error: Firebase: Error (auth/invalid-api-key)

If you're seeing this error, it means your Firebase API key is either missing or invalid. Make sure you've:
1. Created the `.env.local` file
2. Added the correct API key from your Firebase project
3. Restarted your development server 