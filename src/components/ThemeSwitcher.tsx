import { useTheme } from '../hooks/useTheme';
import { THEME_OPTIONS } from '../theme/themes';

// Переключатель тем (Классика / Тёплый / Ночь) — сегментированная группа.
export function ThemeSwitcher() {
  const { theme, setTheme } = useTheme();
  return (
    <div className="pill-group">
      {THEME_OPTIONS.map(({ key, label }) => (
        <button
          key={key}
          type="button"
          className={'seg-btn theme' + (theme === key ? ' active' : '')}
          onClick={() => setTheme(key)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
