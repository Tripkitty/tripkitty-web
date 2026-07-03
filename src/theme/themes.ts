import type { ThemeName } from '../types';

// Наборы токенов тем (Classic / Warm / Night). Значения из README → Design Tokens.
// Применяются как CSS-переменные --<token> на корневом <html>.
// err/ok/inf (+ *-tx) — фоны/текст тост-уведомлений; в README их нет, подобраны под фон каждой темы.
export type ThemeTokens = Record<string, string>;

export const THEMES: Record<ThemeName, ThemeTokens> = {
  classic: {
    page: '#e9e0cb', card: '#f8f1e1', field: '#f2ead4', 'field-bd': '#d8c9a3',
    hdr: '#1e2c44', 'hdr-tx': '#f3ead6', label: '#c8862f', heading: '#1e2c44',
    text: '#2a2a28', muted: '#9a907a', line: '#d3c4a0', btn: '#1e2c44',
    'btn-tx': '#f4ecd8', pos: '#2f7d5b', neg: '#b4533a', accent: '#c8862f',
    chip: '#f2ead4', 'chip-tx': '#5b5340', 'chip-on': '#1e2c44', 'chip-on-tx': '#f4ecd8',
    err: '#a8492f', 'err-tx': '#f8ede2', ok: '#2f7d5b', 'ok-tx': '#ebf5f0',
    inf: '#1e2c44', 'inf-tx': '#f3ead6',
  },
  warm: {
    page: '#e7d8c8', card: '#f7ece0', field: '#f1e4d4', 'field-bd': '#dcc6b1',
    hdr: '#48302a', 'hdr-tx': '#f3e3d4', label: '#cf6a43', heading: '#48302a',
    text: '#352c27', muted: '#a08c7e', line: '#ddc9b6', btn: '#cf6a43',
    'btn-tx': '#fff6ef', pos: '#4f7d4a', neg: '#c2543a', accent: '#cf6a43',
    chip: '#f1e4d4', 'chip-tx': '#5e4a3e', 'chip-on': '#48302a', 'chip-on-tx': '#f3e3d4',
    err: '#b34a31', 'err-tx': '#fff3ec', ok: '#4f7d4a', 'ok-tx': '#f0f6ee',
    inf: '#48302a', 'inf-tx': '#f3e3d4',
  },
  night: {
    page: '#0e151e', card: '#19232f', field: '#212e3c', 'field-bd': '#33414f',
    hdr: '#0a0f16', 'hdr-tx': '#f0e6d2', label: '#f0a93c', heading: '#f0e6d2',
    text: '#e3ddcf', muted: '#8a95a1', line: '#32404e', btn: '#f0a93c',
    'btn-tx': '#16212c', pos: '#5cc08e', neg: '#e3795c', accent: '#f0a93c',
    chip: '#212e3c', 'chip-tx': '#c3cdd7', 'chip-on': '#f0a93c', 'chip-on-tx': '#16212c',
    err: '#b0533a', 'err-tx': '#ffece5', ok: '#31795a', 'ok-tx': '#e3f4eb',
    inf: '#33414f', 'inf-tx': '#f0e6d2',
  },
};

export const THEME_OPTIONS: { key: ThemeName; label: string }[] = [
  { key: 'classic', label: 'Классика' },
  { key: 'warm', label: 'Тёплый' },
  { key: 'night', label: 'Ночь' },
];

// Детерминированная палитра аватаров (одинаковая во всех темах).
export const AVATAR_PALETTE = [
  '#c8862f', '#2f7d5b', '#b4533a', '#3f6f9e', '#8d5bb0',
  '#1b8a7e', '#c25d86', '#5f7a2c', '#9a5bd0', '#b06a2a',
];

export function applyThemeVars(theme: ThemeName) {
  const tokens = THEMES[theme] || THEMES.classic;
  const root = document.documentElement;
  for (const k in tokens) root.style.setProperty('--' + k, tokens[k]);
}
