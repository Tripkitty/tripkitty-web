import { AVATAR_PALETTE } from '../theme/themes';

// Детерминированный цвет аватара по id участника: djb2-хэш → индекс в палитре из 10 цветов.
// Одинаковое имя → разный цвет, потому что id различаются.
export function userColor(id: string): string {
  const str = String(id || '');
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) >>> 0;
  return AVATAR_PALETTE[h % AVATAR_PALETTE.length];
}
