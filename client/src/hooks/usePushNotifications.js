import { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import { useAuthStore } from '../store/useAuthStore';

// Convert base64 VAPID public key to Uint8Array required by PushManager
export const urlBase64ToUint8Array = (base64String) => {
  if (!base64String) return new Uint8Array(0);
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
};

export const usePushNotifications = () => {
  const { user, updateProfile } = useAuthStore();
  const [isSupported, setIsSupported] = useState(false);
  const [permission, setPermission] = useState('default');
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Check support and active subscription status
  const checkStatus = useCallback(async () => {
    if (typeof window === 'undefined') return;

    const supported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
    setIsSupported(supported);

    if (!supported) {
      setPermission('unsupported');
      return;
    }

    setPermission(Notification.permission);

    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      setIsSubscribed(!!sub);
    } catch (err) {
      console.warn('Failed to inspect push subscription', err);
    }
  }, []);

  useEffect(() => {
    checkStatus();
  }, [checkStatus]);

  // Request permission and subscribe to Web Push
  const subscribe = useCallback(async () => {
    if (!isSupported) {
      throw new Error('Push notifications are not supported in this browser.');
    }

    setLoading(true);
    setError(null);

    try {
      // 1. Request browser permission
      const result = await Notification.requestPermission();
      setPermission(result);

      if (result !== 'granted') {
        throw new Error(
          result === 'denied'
            ? 'Notification permission was denied in your browser settings.'
            : 'Notification permission was dismissed.'
        );
      }

      // 2. Fetch VAPID public key from backend
      const { data } = await api.get('/push/public-key');
      const publicKey = data.publicKey;

      if (!publicKey) {
        throw new Error('Server did not provide a VAPID public key.');
      }

      // 3. Register push subscription with browser service worker
      const reg = await navigator.serviceWorker.ready;
      let subscription = await reg.pushManager.getSubscription();

      if (!subscription) {
        subscription = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey)
        });
      }

      // 4. Send subscription keys to backend
      const subJson = subscription.toJSON();
      await api.post('/push/subscribe', {
        endpoint: subJson.endpoint,
        keys: subJson.keys,
        userAgent: navigator.userAgent
      });

      setIsSubscribed(true);

      // 5. Update user push settings on server
      if (user) {
        await api.patch('/users/privacy', {
          pushSettings: {
            ...(user.pushSettings || {}),
            pushEnabled: true
          }
        });
      }

      return { success: true };
    } catch (err) {
      const msg = err.message || 'Failed to subscribe to push notifications';
      setError(msg);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [isSupported, user]);

  // Unsubscribe from Web Push
  const unsubscribe = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      if ('serviceWorker' in navigator) {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();

        if (sub) {
          const endpoint = sub.endpoint;
          await sub.unsubscribe();
          await api.delete('/push/subscribe', { data: { endpoint } });
        }
      }

      setIsSubscribed(false);

      if (user) {
        await api.patch('/users/privacy', {
          pushSettings: {
            ...(user.pushSettings || {}),
            pushEnabled: false
          }
        });
      }

      return { success: true };
    } catch (err) {
      const msg = err.message || 'Failed to unsubscribe';
      setError(msg);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Send a test notification
  const sendTestNotification = useCallback(async () => {
    try {
      const { data } = await api.post('/push/test');
      return data;
    } catch (err) {
      throw new Error(err.response?.data?.message || 'Failed to send test push notification');
    }
  }, []);

  // Update specific notification settings (quiet hours, previews, categories)
  const updatePushSettings = useCallback(
    async (updatedSettings) => {
      try {
        const newSettings = {
          ...(user?.pushSettings || {}),
          ...updatedSettings
        };
        const { data } = await api.patch('/users/privacy', {
          pushSettings: newSettings
        });
        if (data?.user) {
          updateProfile(data.user);
        }
        return data;
      } catch (err) {
        throw new Error(err.response?.data?.message || 'Failed to update push settings');
      }
    },
    [user, updateProfile]
  );

  return {
    isSupported,
    permission,
    isSubscribed,
    loading,
    error,
    subscribe,
    unsubscribe,
    sendTestNotification,
    updatePushSettings,
    checkStatus
  };
};

export default usePushNotifications;
