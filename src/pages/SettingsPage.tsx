import { useTheme } from '../hooks/useTheme';
import { THEMES, THEME_OPTIONS } from '../theme/themes';
import { usePushNotifications } from '../hooks/usePushNotifications';
import { HeaderBand } from '../components/HeaderBand';

// Настройки: цветовая палитра приложения и push-уведомления.
export function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const { supported, permission, subscribed, loading, subscribe, unsubscribe } =
    usePushNotifications();

  const pushOn = subscribed && permission === 'granted';
  const pushBlocked = supported && permission === 'denied';

  const pushDesc = !supported
    ? 'В этом браузере push-уведомления не поддерживаются.'
    : pushBlocked
      ? 'Уведомления заблокированы. Разреши их для этого сайта в настройках браузера.'
      : pushOn
        ? 'Приходят события поездок: новые расходы, заявки в друзья и изменения программы.'
        : 'Получай события поездок, даже когда приложение закрыто.';

  return (
    <div className="view" style={{ maxWidth: 640 }}>
      <div className="card">
        <HeaderBand eyebrow="Персонализация" title="Настройки" />
        <div className="card-body">
          {/* Цветовая палитра */}
          <section className="card-section">
            <label className="field-label">Цветовая палитра</label>
            <div className="theme-grid">
              {THEME_OPTIONS.map(({ key, label }) => {
                const t = THEMES[key];
                return (
                  <button
                    key={key}
                    type="button"
                    className={'theme-card' + (theme === key ? ' active' : '')}
                    onClick={() => setTheme(key)}
                  >
                    <span className="theme-preview" style={{ background: t.page }}>
                      <span className="tp-card" style={{ background: t.card, borderColor: t.line }}>
                        <span className="tp-dot" style={{ background: t.accent }} />
                        <span className="tp-bar" style={{ background: t.heading }} />
                        <span className="tp-bar short" style={{ background: t.muted }} />
                      </span>
                    </span>
                    <span className="theme-card-label">{label}</span>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Уведомления */}
          <section className="card-section">
            <label className="field-label">Уведомления</label>
            <div className="setting-row">
              <div className="setting-meta">
                <span className="setting-title">Push-уведомления</span>
                <span className="setting-desc">{pushDesc}</span>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={pushOn}
                aria-label="Push-уведомления"
                className={'switch' + (pushOn ? ' on' : '')}
                disabled={!supported || pushBlocked || loading}
                onClick={pushOn ? unsubscribe : subscribe}
              >
                <span className="knob" />
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
