// Форматирование имён, чисел и дат. Порт из прототипа (renderVals / методы класса) — без изменений.

// Правило отображения имени: только первое слово (имя), даже если введено ФИО.
export function disp(name: string): string {
  const w = (name || '').trim().split(/\s+/);
  return w[0] || (name || '');
}

// Первая буква display-имени для аватара.
export function initial(name: string): string {
  return (disp(name) || '?').trim().charAt(0).toUpperCase() || '?';
}

// Русские склонения: «1 участник / 2 участника / 5 участников».
export function plural(n: number, one: string, few: string, many: string): string {
  const m10 = n % 10;
  const m100 = n % 100;
  let w = many;
  if (m10 === 1 && m100 !== 11) w = one;
  else if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) w = few;
  return n + ' ' + w;
}

// Форматирование валюты: округление до 2 знаков, «.00» отбрасывается, разделитель тысяч
// — неразрывный пробел U+00A0, десятичная запятая, «−» (U+2212) для отрицательных,
// в конце неразрывный пробел и глиф валюты.
export function fmt(n: number, cur: string): string {
  n = Math.round(n * 100) / 100;
  const neg = n < 0;
  n = Math.abs(n);
  let s = Math.abs(n % 1) < 1e-9 ? String(Math.round(n)) : n.toFixed(2);
  const parts = s.split('.');
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  s = parts.join(',');
  return (neg ? '−' : '') + s + ' ' + (cur || '');
}

// Телефон СБП: сервер нормализует к +7XXXXXXXXXX; красиво разбиваем на «+7 999 123-45-67».
// Если строка не в ожидаемом формате — возвращаем как есть.
export function formatPhone(phone: string): string {
  const d = (phone || '').replace(/\D/g, '');
  const ten = d.length === 11 && (d[0] === '7' || d[0] === '8') ? d.slice(1) : d;
  if (ten.length !== 10) return phone || '';
  return `+7 ${ten.slice(0, 3)} ${ten.slice(3, 6)}-${ten.slice(6, 8)}-${ten.slice(8, 10)}`;
}

// Оставляет до 10 «национальных» цифр РФ-номера. Ведущий код страны 7/8 всегда
// отбрасывается — в т.ч. цифра «7» из маски «+7», которую при повторном разборе
// value иначе принимали бы за национальную (номера РФ начинаются с 9, не с 7/8).
export function ruPhoneDigits(input: string): string {
  let d = (input || '').replace(/\D/g, '');
  if (d[0] === '7' || d[0] === '8') d = d.slice(1);
  return d.slice(0, 10);
}

// Маска ввода: «+7 (999) 123-45-67». Пустой ввод → '' (чтобы был виден placeholder).
export function formatRuPhoneInput(input: string): string {
  const d = ruPhoneDigits(input);
  if (!d) return '';
  let out = '+7 (' + d.slice(0, 3);
  if (d.length >= 3) out += ')';
  if (d.length > 3) out += ' ' + d.slice(3, 6);
  if (d.length > 6) out += '-' + d.slice(6, 8);
  if (d.length > 8) out += '-' + d.slice(8, 10);
  return out;
}

// Нормализация к формату сервера +7XXXXXXXXXX; '' если номер неполный.
export function ruPhoneE164(input: string): string {
  const d = ruPhoneDigits(input);
  return d.length === 10 ? '+7' + d : '';
}

const MONTHS = [
  'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
  'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря',
];
const WEEKDAYS = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];

// Русские месяцы и умные диапазоны (тот же месяц → «12–15 июня»; текущий год опускается).
export function fmtDate(start: string, end?: string): string {
  if (!start) return '';
  const p = (str: string) => {
    const a = str.split('-');
    return { y: +a[0], m: +a[1] - 1, d: +a[2] };
  };
  let a = p(start);
  let b = end && end !== start ? p(end) : null;
  if (b && new Date(start) > new Date(end as string)) {
    const t = a;
    a = b;
    b = t;
  }
  const cy = new Date().getFullYear();
  if (!b) return a.d + ' ' + MONTHS[a.m] + (a.y !== cy ? ' ' + a.y : '');
  if (a.y !== b.y)
    return a.d + ' ' + MONTHS[a.m] + ' ' + a.y + ' – ' + b.d + ' ' + MONTHS[b.m] + ' ' + b.y;
  const yr = a.y !== cy ? ' ' + a.y : '';
  if (a.m === b.m) return a.d + '–' + b.d + ' ' + MONTHS[a.m] + yr;
  return a.d + ' ' + MONTHS[a.m] + ' – ' + b.d + ' ' + MONTHS[b.m] + yr;
}

// «вт, 13 июня» — короткий день недели + дата одного дня.
export function fmtDayLong(d: string): string {
  const a = d.split('-');
  const dt = new Date(+a[0], +a[1] - 1, +a[2]);
  return WEEKDAYS[dt.getDay()] + ', ' + fmtDate(d);
}
