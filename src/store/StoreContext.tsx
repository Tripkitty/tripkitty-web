import { createContext, useEffect, useReducer, type ReactNode } from 'react';
import { repository } from '../data/localStorageRepository';
import { seedDb } from '../data/seed';
import { migrateHandles } from '../lib/migrate';
import { reducer, type State } from './reducer';
import type { Action } from './actions';

type StoreValue = State & { dispatch: React.Dispatch<Action> };

// eslint-disable-next-line react-refresh/only-export-components
export const StoreContext = createContext<StoreValue | null>(null);

// Инициализация корневого состояния из репозитория (с засевом демо-данных и миграцией handle).
function init(): State {
  let db = repository.loadDB();
  if (!db) db = seedDb();
  migrateHandles(db);

  let sessionUserId = repository.loadSession();
  if (sessionUserId && !db.users[sessionUserId]) sessionUserId = null;

  return { db, sessionUserId };
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, init);

  // Персист db в репозиторий при каждом изменении (→ заменить на вызовы API).
  useEffect(() => {
    repository.saveDB(state.db);
  }, [state.db]);

  // Персист сессии (→ auth-токен).
  useEffect(() => {
    repository.saveSession(state.sessionUserId);
  }, [state.sessionUserId]);

  // Подписка на внешние изменения общей БД (cross-tab / realtime).
  useEffect(() => {
    return repository.subscribe((db) => dispatch({ type: 'externalDB', db }));
  }, []);

  return <StoreContext.Provider value={{ ...state, dispatch }}>{children}</StoreContext.Provider>;
}
