// Access token: в памяти (сбрасывается при перезагрузке; восстанавливается через refresh).
// Refresh token: в IndexedDB (переживает перезагрузку страницы).

let _access: string | null = null;

const IDB_NAME = 'tripkitty';
const IDB_STORE = 'auth';
const REFRESH_KEY = 'refreshToken';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(IDB_STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function getRefreshToken(): Promise<string | null> {
  try {
    const db = await openDb();
    return new Promise((resolve) => {
      const req = db.transaction(IDB_STORE, 'readonly').objectStore(IDB_STORE).get(REFRESH_KEY);
      req.onsuccess = () => resolve((req.result as string | undefined) ?? null);
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

export async function setTokens(access: string, refresh: string): Promise<void> {
  _access = access;
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      tx.objectStore(IDB_STORE).put(refresh, REFRESH_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch { /* ignore */ }
}

export function getAccessToken(): string | null {
  return _access;
}

export function setAccessToken(token: string): void {
  _access = token;
}

export async function clearTokens(): Promise<void> {
  _access = null;
  try {
    const db = await openDb();
    await new Promise<void>((resolve) => {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      tx.objectStore(IDB_STORE).delete(REFRESH_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch { /* ignore */ }
}

export function hasAccessToken(): boolean {
  return _access !== null;
}
