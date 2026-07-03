import { useEffect, useState } from 'react';
import { push } from '../api/api';
import { useToast } from './useToast';

type PermissionState = 'default' | 'granted' | 'denied';

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(b64);
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

export function usePushNotifications() {
  const toast = useToast();
  const [permission, setPermission] = useState<PermissionState>(
    () => (typeof Notification !== 'undefined' ? Notification.permission : 'denied')
  );
  const [subscribed, setSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);
  const supported = typeof Notification !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window;

  useEffect(() => {
    if (!supported) return;
    navigator.serviceWorker.ready.then((reg) => {
      reg.pushManager.getSubscription().then((sub) => {
        setSubscribed(sub !== null);
      });
    });
  }, [supported]);

  const subscribe = async () => {
    if (!supported) return;
    setLoading(true);
    try {
      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm !== 'granted') return;

      const { publicKey } = await push.getVapidKey();
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey).buffer as ArrayBuffer,
      });

      const json = sub.toJSON();
      const keys = json.keys as { p256dh: string; auth: string };
      await push.subscribe(sub.endpoint, keys.p256dh, keys.auth);
      setSubscribed(true);
    } catch {
      // Ошибку показываем явно — иначе колокольчик молча остаётся неактивным (см. CLAUDE.md).
      toast.error('Не удалось подключить уведомления. Попробуй позже.');
    } finally {
      setLoading(false);
    }
  };

  const unsubscribe = async () => {
    if (!supported) return;
    setLoading(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await push.unsubscribe(sub.endpoint);
        await sub.unsubscribe();
      }
      setSubscribed(false);
    } finally {
      setLoading(false);
    }
  };

  return { supported, permission, subscribed, loading, subscribe, unsubscribe };
}
