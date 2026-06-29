import type { DB, ThemeName } from '../types';

// Абстракция слоя данных. Прототип хранит всё в localStorage, но весь UI работает
// только через этот интерфейс — реализацию легко заменить на реальный бэкенд + авторизацию
// (loadDB/saveDB → fetch к API, subscribe → websocket/polling, session → auth-токен).
export interface Repository {
  loadDB(): DB | null;
  saveDB(db: DB): void;

  loadSession(): string | null;
  saveSession(userId: string | null): void;

  loadTheme(): ThemeName | null;
  saveTheme(theme: ThemeName): void;

  // Подписка на внешние изменения общей БД (в прототипе — cross-tab storage-событие,
  // в проде — realtime/refetch). Возвращает функцию отписки.
  subscribe(onExternalChange: (db: DB) => void): () => void;
}
