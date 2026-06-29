import type { DB } from '../types';

// Бэкфилл недостающих handle из локальной части email (санитизация + дедупликация).
// Порт migrateHandles(). Мутирует переданный db (как в прототипе).
export function migrateHandles(db: DB): void {
  if (!db || !db.users) return;
  const taken = new Set(
    Object.values(db.users)
      .map((u) => u.handle)
      .filter(Boolean),
  );
  Object.values(db.users).forEach((u) => {
    if (u.handle) return;
    let base = ((u.email || u.name || 'user').split('@')[0] || 'user')
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, '');
    if (base.length < 3) base = (base + 'user').slice(0, 8);
    base = base.slice(0, 20);
    let h = base;
    let i = 1;
    while (taken.has(h)) {
      h = (base.slice(0, 17) + i).slice(0, 20);
      i++;
    }
    taken.add(h);
    u.handle = h;
  });
}
