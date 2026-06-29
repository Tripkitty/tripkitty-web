import type { ReactNode } from 'react';

type Props = {
  eyebrow: string;
  title?: ReactNode;
  decoSize?: number; // диаметр декоративного круга справа сверху
  titleSize?: string; // CSS размер заголовка (clamp)
  children?: ReactNode; // доп. содержимое внутри band (back-chip, sync pill и т.п.)
};

// Шапка-band: тёмный фон --hdr с декоративным кругом, eyebrow и крупным заголовком.
export function HeaderBand({ eyebrow, title, decoSize = 180, titleSize = 'clamp(24px, 5vw, 32px)', children }: Props) {
  return (
    <div className="header-band">
      <div className="deco" style={{ width: decoSize, height: decoSize }} />
      <div style={{ position: 'relative' }}>
        {children}
        <div className="eyebrow">{eyebrow}</div>
        {title != null && (
          <h1 className="title" style={{ fontSize: titleSize }}>
            {title}
          </h1>
        )}
      </div>
    </div>
  );
}
