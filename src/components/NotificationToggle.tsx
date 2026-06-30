import { usePushNotifications } from '../hooks/usePushNotifications';

export function NotificationToggle() {
  const { supported, permission, subscribed, loading, subscribe, unsubscribe } =
    usePushNotifications();

  if (!supported || permission === 'denied') return null;

  const active = subscribed && permission === 'granted';
  const title = active ? 'Отключить уведомления' : 'Включить уведомления';

  return (
    <button
      type="button"
      className={'notif-btn' + (active ? ' active' : '')}
      title={title}
      disabled={loading}
      onClick={active ? unsubscribe : subscribe}
    >
      <BellIcon muted={!active} />
    </button>
  );
}

function BellIcon({ muted }: { muted: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
      {muted && <line x1="1" y1="1" x2="23" y2="23" />}
    </svg>
  );
}
