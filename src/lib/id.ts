// Генератор коротких случайных id. Порт uid() из прототипа.
export function uid(): string {
  return 'x' + Math.random().toString(36).slice(2, 9);
}
