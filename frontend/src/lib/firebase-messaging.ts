import { getMessaging, getToken, onMessage, isSupported, Messaging } from 'firebase/messaging';
import { auth } from './firebase';
import { logger } from './logger';

// Lazy import to avoid circular dependencies
let notificationsAPI: {
  registerFCMToken: (token: string) => Promise<void>;
} | null = null;

const getNotificationsAPI = async () => {
  if (!notificationsAPI) {
    const { notificationsAPI: api } = await import('./api');
    notificationsAPI = api;
  }
  return notificationsAPI;
};

// Firebase messaging interfaces
interface FirebaseNotification {
  title?: string;
  body?: string;
  icon?: string;
  click_action?: string;
}

interface FirebaseMessagePayload {
  notification?: FirebaseNotification;
  data?: Record<string, string>;
  from?: string;
  messageId?: string;
  sentTime?: number;
}

// Initialize Firebase messaging only on client side
let messaging: Messaging | null = null;
let messagingInstance: Promise<Messaging | null> | null = null;

/**
 * Resolves the messaging instance, or null on a browser that cannot do push.
 *
 * `getMessaging()` looks synchronous but runs its own support check as a
 * floating promise and throws from inside it, so a try/catch around the call
 * catches nothing - the failure arrives later as an unhandled rejection. On
 * iOS Safari that is guaranteed rather than occasional, and it reached Sentry
 * as an unhandled error on every page load for a signed-in visitor. Asking
 * `isSupported()` first is the guard Firebase documents for exactly this, and
 * it turns an unsupported browser into a null rather than a crash report.
 *
 * The promise is memoised, including a null result: a browser that cannot do
 * push will not start being able to mid-session, and re-asking would re-run
 * the IndexedDB probe on every call.
 */
const getMessagingInstance = async (): Promise<Messaging | null> => {
  if (typeof window === 'undefined') {
    return null;
  }

  if (!messagingInstance) {
    messagingInstance = (async () => {
      // Check if Firebase is properly initialized
      if (!auth || !auth.app) {
        logger.error('Firebase not properly initialized for messaging');
        return null;
      }

      // Not an error: a browser without the push APIs is a supported visitor,
      // not a fault, so this must not open an issue in the error tracker.
      if (!(await isSupported())) {
        logger.info('Push messaging is not supported in this browser');
        return null;
      }

      try {
        messaging = getMessaging(auth.app);
        return messaging;
      } catch (error: unknown) {
        // Failed to initialize Firebase messaging - push notifications unavailable
        logger.error('Failed to initialize Firebase messaging', { error: error instanceof Error ? error.message : 'Unknown error' });
        return null;
      }
    })();
  }

  return messagingInstance;
};

// Request notification permission and get FCM token
export const requestNotificationPermission = async (): Promise<string | null> => {
  try {
    // Check if we're in a browser environment. Absence of the Notification API
    // is a property of the browser, not a fault, so it is logged at info -
    // warn and above are forwarded to the error tracker.
    if (typeof window === 'undefined' || !('Notification' in window)) {
      logger.info('Notifications not supported in this environment');
      return null;
    }

    const instance = await getMessagingInstance();
    if (!instance) {
      logger.info('Firebase messaging not available');
      return null;
    }

    // Request permission
    const permission = await Notification.requestPermission();

    if (permission === 'granted') {
      logger.info('Notification permission granted');
      
      // Get FCM token
      const token = await getToken(instance, {
        vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY
      });
      
      if (token) {

        
        // Send token to backend
        await registerFCMToken(token);
        
        return token;
      } else {
        return null;
      }
    } else {
      return null;
    }
  } catch (error: unknown) {
    // Failed to request notification permission or get FCM token
    logger.error('Failed to setup notifications', { error: error instanceof Error ? error.message : 'Unknown error' });
    return null;
  }
};

// Register FCM token with backend using enhanced API service
const registerFCMToken = async (token: string) => {
  try {
    const user = auth.currentUser;
    if (!user) return;

    const api = await getNotificationsAPI();
    await api.registerFCMToken(token);
  } catch (error: unknown) {
    // Failed to register FCM token - push notifications may not work properly
    logger.error('Failed to register FCM token', { error: error instanceof Error ? error.message : 'Unknown error' });
    // Retry mechanism is handled by the API service
  }
};

// Handle foreground messages
export const setupForegroundMessageListener = async (callback: (payload: FirebaseMessagePayload) => void) => {
  const instance = await getMessagingInstance();
  if (!instance) {
    return () => {}; // Return empty cleanup function
  }

  return onMessage(instance, (payload) => {

    callback(payload);
  });
};

// Show notification toast in foreground
export const showForegroundNotification = (payload: FirebaseMessagePayload) => {
  // Create a custom notification or use your toast system
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification(payload.notification?.title || 'Sokin Notification', {
      body: payload.notification?.body,
      icon: '/images/icon-192x192.png',
      tag: payload.data?.type,
      data: payload.data
    });
  }
};

// Initialize messaging for the app
export const initializeMessaging = async () => {
  // Check if we're in a browser environment
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    logger.info('Not in browser environment, skipping FCM initialization');
    return;
  }

  if ('serviceWorker' in navigator) {
    try {
      // Check if Firebase is properly initialized before proceeding
      if (!auth || !auth.app) {
        logger.error('Firebase not properly initialized, skipping messaging setup');
        return;
      }

      // Register service worker with its own scope to avoid conflicts with sw.js
      await navigator.serviceWorker.register('/firebase-messaging-sw.js', {
        scope: '/firebase-cloud-messaging-push-scope',
      });
      logger.info('Service worker registered for Firebase messaging');

      // Request notification permission and get token
      await requestNotificationPermission();

      // Setup foreground message listener
      await setupForegroundMessageListener(showForegroundNotification);

    } catch (error: unknown) {
      // Failed to initialize Firebase messaging service - push notifications unavailable
      logger.error('Failed to initialize messaging service', { error: error instanceof Error ? error.message : 'Unknown error' });
    }
  } else {
    // A browser without service workers cannot receive push at all. That is a
    // capability of the browser, not a failure, so it stays out of the tracker.
    logger.info('Service Worker not supported in this browser');
  }
}; 