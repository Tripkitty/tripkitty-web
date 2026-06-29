import { useContext } from 'react';
import { StoreContext } from '../store/StoreContext';

// Доступ к корневому состоянию { db, sessionUserId } и dispatch.
export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used within <StoreProvider>');
  return ctx;
}

// Текущий залогиненный пользователь (или undefined).
export function useMe() {
  const { db, sessionUserId } = useStore();
  return sessionUserId ? db.users[sessionUserId] : undefined;
}
