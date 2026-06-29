import type { DB, ThemeName } from '../types';
import type { Repository } from './repository';

// Реализация репозитория на localStorage с синхронизацией между вкладками через storage-событие.
// Multi-user в прототипе симулируется несколькими вкладками в одном браузере.
// TODO(backend): заменить на REST/GraphQL + realtime; session → auth-токен; пароли — на сервере.
const DB_KEY = 'tripsplit_db_v2';
const SESSION_KEY = 'tripsplit_session_v2';
const THEME_KEY = 'tripsplit_theme_v2';

export class LocalStorageRepository implements Repository {
  loadDB(): DB | null {
    try {
      const r = JSON.parse(localStorage.getItem(DB_KEY) || 'null');
      if (r && r.users) return r as DB;
    } catch {
      /* ignore */
    }
    return null;
  }

  saveDB(db: DB): void {
    try {
      localStorage.setItem(DB_KEY, JSON.stringify(db));
    } catch {
      /* ignore */
    }
  }

  loadSession(): string | null {
    try {
      return localStorage.getItem(SESSION_KEY) || null;
    } catch {
      return null;
    }
  }

  saveSession(userId: string | null): void {
    try {
      if (userId) localStorage.setItem(SESSION_KEY, userId);
      else localStorage.removeItem(SESSION_KEY);
    } catch {
      /* ignore */
    }
  }

  loadTheme(): ThemeName | null {
    try {
      return (localStorage.getItem(THEME_KEY) as ThemeName) || null;
    } catch {
      return null;
    }
  }

  saveTheme(theme: ThemeName): void {
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {
      /* ignore */
    }
  }

  subscribe(onExternalChange: (db: DB) => void): () => void {
    const handler = (e: StorageEvent) => {
      if (e.key === DB_KEY && e.newValue) {
        try {
          const db = JSON.parse(e.newValue);
          if (db && db.users) onExternalChange(db as DB);
        } catch {
          /* ignore */
        }
      }
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }
}

export const repository: Repository = new LocalStorageRepository();
