import { getMessaging, getToken, onMessage } from 'firebase/messaging';
import { auth } from './firebase';
import { notificationsAPI } from './api-services';

// Initialize Firebase messaging only on client side
let messaging: any = null;

const initializeMessagingInstance = () => {
  if (typeof window !== 'undefined' && !messaging) {
    try {
      messaging = getMessaging();
    } catch (error) {

    }
  }
  return messaging;
};

// Request notification permission and get FCM token
export const requestNotificationPermission = async (): Promise<string | null> => {
  try {
    // Check if we're in a browser environment
    if (typeof window === 'undefined' || !('Notification' in window)) {
      ('Notifications not supported in this environment');
      return null;
    }

    const messagingInstance = initializeMessagingInstance();
    if (!messagingInstance) {
      ('Firebase messaging not available');
      return null;
    }

    // Request permission
    const permission = await Notification.requestPermission();
    
    if (permission === 'granted') {
      ('Notification permission granted.');
      
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
  } catch (error) {

    return null;
  }
};

// Register FCM token with backend using enhanced API service
const registerFCMToken = async (token: string) => {
  try {
    const user = auth.currentUser;
    if (!user) return;
    
    await notificationsAPI.registerFCMToken(token);
  } catch (error) {

    // Retry mechanism is handled by the API service
  }
};

// Handle foreground messages
export const setupForegroundMessageListener = (callback: (payload: any) => void) => {
  const messagingInstance = initializeMessagingInstance();
  if (!messagingInstance) {
    return () => {}; // Return empty cleanup function
  }
  
  return onMessage(messagingInstance, (payload) => {

    callback(payload);
  });
};

// Show notification toast in foreground
export const showForegroundNotification = (payload: any) => {
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
    ('Not in browser environment, skipping FCM initialization');
    return;
  }

  if ('serviceWorker' in navigator) {
    try {
      // Register service worker
      const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');

      
      // Request notification permission and get token
      await requestNotificationPermission();
      
      // Setup foreground message listener
      setupForegroundMessageListener(showForegroundNotification);
      
    } catch (error) {

    }
  } else {
    // Service Worker not supported in this browser
  }
}; 