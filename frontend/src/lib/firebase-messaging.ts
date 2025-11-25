import { getMessaging, getToken, onMessage, Messaging } from 'firebase/messaging';
import { auth } from './firebase';
import { logger } from './logger';

// Helper function to safely extract error message
const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) return error.message;
  return String(error);
};

// Lazy import to avoid circular dependencies
let notificationsAPI: {
  registerFCMToken: (token: string) => Promise<void>;
} | null = null;

const getNotificationsAPI = async () => {
  if (!notificationsAPI) {
    const { notificationsAPI: api } = await import('./api-services');
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

const initializeMessagingInstance = () => {
  if (typeof window !== 'undefined' && !messaging) {
    try {
      // Check if Firebase is properly initialized
      if (!auth || !auth.app) {
        logger.error('Firebase not properly initialized for messaging');
        return null;
      }

      messaging = getMessaging(auth.app);
    } catch (error: unknown) {
      // Failed to initialize Firebase messaging - push notifications unavailable
      logger.error('Failed to initialize Firebase messaging', { error: getErrorMessage(error) });
      messaging = null;
    }
  }
  return messaging;
};

// Request notification permission and get FCM token
export const requestNotificationPermission = async (): Promise<string | null> => {
  try {
    // Check if we're in a browser environment
    if (typeof window === 'undefined' || !('Notification' in window)) {
      logger.warn('Notifications not supported in this environment');
      return null;
    }

    const messagingInstance = initializeMessagingInstance();
    if (!messagingInstance) {
      logger.warn('Firebase messaging not available');
      return null;
    }

    // Request permission
    const permission = await Notification.requestPermission();

    if (permission === 'granted') {
      logger.info('Notification permission granted');
      
      // Get FCM token
      const token = await getToken(messagingInstance, {
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
    logger.error('Failed to setup notifications', { error: getErrorMessage(error) });
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
    logger.error('Failed to register FCM token', { error: getErrorMessage(error) });
    // Retry mechanism is handled by the API service
  }
};

// Handle foreground messages
export const setupForegroundMessageListener = (callback: (payload: FirebaseMessagePayload) => void) => {
  const messagingInstance = initializeMessagingInstance();
  if (!messagingInstance) {
    return () => {}; // Return empty cleanup function
  }
  
  return onMessage(messagingInstance, (payload) => {

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
  // Temporarily disable Firebase messaging until properly configured
  return;
  
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

      // Register service worker
      await navigator.serviceWorker.register('/firebase-messaging-sw.js');
      logger.info('Service worker registered for Firebase messaging');

      // Request notification permission and get token
      await requestNotificationPermission();

      // Setup foreground message listener
      setupForegroundMessageListener(showForegroundNotification);

    } catch (err) {
      // Failed to initialize Firebase messaging service - push notifications unavailable
      logger.error('Failed to initialize messaging service', { 
        error: getErrorMessage(err)
      });
    }
  } else {
    // Service Worker not supported in this browser
    logger.warn('Service Worker not supported in this browser');
  }
}; 