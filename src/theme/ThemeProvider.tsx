import { createContext, useCallback, useEffect, useState, type ReactNode } from 'react';
import type { ThemeName } from '../types';
import { applyThemeVars } from './themes';
import { repository } from '../data/localStorageRepository';

type ThemeValue = { theme: ThemeName; setTheme: (t: ThemeName) => void };

// eslint-disable-next-line react-refresh/only-export-components
export const ThemeContext = createContext<ThemeValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeName>(() => repository.loadTheme() || 'classic');

  // Применяем CSS-переменные темы на <html> и сохраняем выбор (→ user-prefs на бэкенде).
  useEffect(() => {
    applyThemeVars(theme);
    repository.saveTheme(theme);
  }, [theme]);

  const setTheme = useCallback((t: ThemeName) => setThemeState(t), []);

  return <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>;
}
