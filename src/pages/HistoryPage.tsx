import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { whatsNew as whatsNewApi, type ApiRelease } from '../api/api';
import { HeaderBand } from '../components/HeaderBand';
import { ReleaseList } from '../components/ReleaseList';

// История изменений: вся история релизов (без since), read-only — не трогает
// localStorage-состояние плашки «что нового» (useWhatsNew).
export function HistoryPage() {
  const [releases, setReleases] = useState<ApiRelease[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    whatsNewApi.get().then(({ whatsNew }) => {
      if (!cancelled) setReleases(whatsNew.releases);
    }).catch(() => {
      if (!cancelled) setReleases([]);
    });
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="view">
      <div className="card">
        <HeaderBand eyebrow="Обновления" title="История изменений">
          <Link to="/settings" className="header-close" aria-label="Закрыть">
            <CloseIcon />
          </Link>
        </HeaderBand>
        <div className="card-body">
          {releases == null && <div className="empty">Загрузка…</div>}
          {releases != null && releases.length === 0 && <div className="empty">Пока нет записей.</div>}
          {releases != null && releases.length > 0 && <ReleaseList releases={releases} />}
        </div>
      </div>
    </div>
  );
}

function CloseIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M18 6L6 18M6 6l12 12" />
    </svg>
  );
}
