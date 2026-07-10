import type { ApiRelease } from '../api/api';

// Разметка списка релизов — общая для плашки WhatsNew и страницы истории изменений.
export function ReleaseList({ releases }: { releases: ApiRelease[] }) {
  return (
    <>
      {releases.map((r) => (
        <section key={r.version} className="whatsnew-release">
          <div className="whatsnew-release-head">
            <span className="whatsnew-title">{r.title}</span>
            {r.date && <span className="whatsnew-date">{r.date}</span>}
          </div>
          <ul className="whatsnew-items">
            {r.items.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        </section>
      ))}
    </>
  );
}
