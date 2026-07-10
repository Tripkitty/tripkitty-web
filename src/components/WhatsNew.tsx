import { useWhatsNew } from '../hooks/useWhatsNew';
import { ReleaseList } from './ReleaseList';

// Плашка «что нового» после обновления. Ненавязчивый bottom sheet, закрывается крестиком / по фону.
export function WhatsNew({ enabled }: { enabled: boolean }) {
  const { releases, dismiss } = useWhatsNew(enabled);

  if (releases.length === 0) return null;

  return (
    <div className="whatsnew-backdrop" onClick={dismiss}>
      <div
        className="whatsnew-sheet"
        role="dialog"
        aria-modal="true"
        aria-label="Что нового"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="whatsnew-head">
          <span className="whatsnew-eyebrow">Что нового</span>
          <button type="button" className="whatsnew-close" onClick={dismiss} aria-label="Закрыть">
            <CloseIcon />
          </button>
        </div>

        <div className="whatsnew-body">
          <ReleaseList releases={releases} />
        </div>

        <button type="button" className="btn whatsnew-ok" onClick={dismiss}>
          Понятно
        </button>
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
