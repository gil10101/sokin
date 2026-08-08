import { initializeApp, getApps } from "firebase/app"
import { getAuth } from "firebase/auth"

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
}

/**
 * Stand-in config used only when prerendering without the real values.
 *
 * `getAuth()` runs at module scope, and the root layout pulls this file into
 * every statically generated page - including framework pages like
 * /_not-found. With no NEXT_PUBLIC_FIREBASE_API_KEY present it threw
 * `auth/invalid-api-key` during "Generating static pages" and took the whole
 * build down, which is why CI could never build the app.
 *
 * Substituting a placeholder is safe specifically because this is the *client*
 * SDK: there is no signed-in user on the server, so a prerender never reads
 * anything off this instance. Nothing is authenticated against the placeholder
 * project because nothing is authenticated at all.
 */
// Deliberately not shaped like a Google API key. An earlier version of this
// used an "AIza..."-prefixed literal, which is the pattern secret scanners
// match on - it raised a credential alert on a value that was never a
// credential. A fake secret that trips the alarm is worse than no fake secret
// at all, because it teaches everyone to wave the alarm through.
const PRERENDER_PLACEHOLDER = {
  apiKey: "prerender-placeholder-not-a-credential",
  authDomain: "prerender.invalid",
  projectId: "prerender-placeholder",
}

/**
 * In the browser the real config is required, and its absence stays fatal
 * exactly as before - a silently unauthenticated app would be far worse than a
 * loud failure. Only the server path falls back, so behaviour where it matters
 * is unchanged.
 */
const isBrowser = typeof window !== "undefined"
const configForInit =
  firebaseConfig.apiKey || isBrowser ? firebaseConfig : PRERENDER_PLACEHOLDER

// Initialize Firebase only if it hasn't been initialized already
const app = !getApps().length ? initializeApp(configForInit) : getApps()[0]
const auth = getAuth(app)

/**
 * Auth only, deliberately. Every read and write goes through the backend API,
 * which owns validation and ownership checks - the client never talks to
 * Firestore directly. A `getFirestore(app)` call used to sit here with no
 * importers, and from firebase 12.17 it throws "Service firestore is not
 * available" while prerendering, breaking the production build.
 */
export { auth }

