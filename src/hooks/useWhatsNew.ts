import { useEffect, useState } from 'react';
import { whatsNew as whatsNewApi, type ApiRelease } from '../api/api';

// Последняя показанная версия релиза — в localStorage (см. секцию 12 CLIENT_API_GUIDE).
const SEEN_KEY = 'whatsNewSeenVersion';

function readSeen(): number | null {
  try {
    const raw = localStorage.getItem(SEEN_KEY);
    if (raw == null) return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

function writeSeen(version: number) {
  try {
    localStorage.setItem(SEEN_KEY, String(version));
  } catch {
    // localStorage может быть недоступен (приватный режим) — молча игнорируем.
  }
}

// Плашка «что нового»: решает, показывать ли релизы, сравнивая версию с сохранённой локально.
// Возвращает список релизов для показа (пустой = не показывать) и функцию закрытия.
export function useWhatsNew(enabled: boolean) {
  const [releases, setReleases] = useState<ApiRelease[]>([]);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    (async () => {
      const seen = readSeen();
      try {
        // Первый запуск (ключа ещё нет) — запоминаем текущую версию и плашку не показываем.
        const { whatsNew } = await whatsNewApi.get(seen ?? undefined);
        if (cancelled) return;

        if (seen == null) {
          writeSeen(whatsNew.latestVersion);
          return;
        }
        if (whatsNew.releases.length > 0) {
          setReleases(whatsNew.releases);
          // Запоминаем сразу при показе — плашку не покажем повторно после перезагрузки.
          writeSeen(whatsNew.latestVersion);
        }
      } catch {
        // Информация о релизе не критична — при ошибке сети просто не показываем плашку.
      }
    })();

    return () => { cancelled = true; };
  }, [enabled]);

  const dismiss = () => setReleases([]);

  return { releases, dismiss };
}

// Бейдж «есть новое» для входа в историю изменений: сравнивает latestVersion с сохранённой
// локально версией, но сама ничего в localStorage не пишет — маркером «просмотрено» остаётся
// только показ/закрытие плашки WhatsNew выше.
export function useHasNewReleases(enabled: boolean) {
  const [hasNew, setHasNew] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    (async () => {
      try {
        const { whatsNew } = await whatsNewApi.get();
        if (cancelled) return;
        const seen = readSeen();
        if (seen != null && whatsNew.latestVersion > seen) setHasNew(true);
      } catch {
        // Не критично — просто не показываем бейдж.
      }
    })();

    return () => { cancelled = true; };
  }, [enabled]);

  return hasNew;
}
