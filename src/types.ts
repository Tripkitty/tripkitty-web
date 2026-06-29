// Доменная модель приложения «Делим счёт».
// Соответствует Data Model из design_handoff_split_app/README.md.

export type User = {
  id: string; // 'u_' + random
  name: string; // полное имя как ввёл пользователь — может быть «Фамилия Имя Отчество»
  handle: string; // УНИКАЛЬНЫЙ логин, lowercase, [a-z0-9_]{3,20}, без ведущего @
  email: string; // уникальный, используется только для входа
  pass: string; // TODO(auth): plaintext в прототипе — заменить на реальную аутентификацию (хэш на бэкенде)
  friends: string[]; // id пользователей (взаимные)
  incoming: string[]; // id пользователей, приславших МНЕ заявку
  outgoing: string[]; // id пользователей, которым заявку отправил я
};

export type Guest = { id: string; name: string }; // id 'g_' + random; без аккаунта

export type Expense = {
  id: string;
  title: string;
  amount: number;
  payer: string; // id участника (user или guest)
  share: string[]; // id участников, между которыми делится поровну
  createdBy: string; // id пользователя
};

export type TripEvent = {
  id: string;
  title: string;
  date: string; // 'YYYY-MM-DD'
  time: string; // 'HH:MM' или '' (весь день)
  endTime: string; // 'HH:MM' или '' (значимо только если задан time)
  createdBy: string;
};

export type Trip = {
  id: string;
  name: string;
  cur: string; // глиф валюты: ₽ $ € ₸ ₴
  ownerId: string;
  start: string; // 'YYYY-MM-DD' или ''
  end: string; // 'YYYY-MM-DD' или ''
  version?: number; // оптимистичная блокировка при PATCH /trips/{id}
  members: string[]; // id пользователей
  guests: Guest[];
  expenses: Expense[];
  events: TripEvent[];
};

export type DB = { users: Record<string, User>; trips: Trip[] };

// Унифицированный взгляд на members + guests конкретной поездки.
export type Participant = {
  id: string;
  name: string; // display = только первое слово
  kind: 'friend' | 'guest';
  isMe: boolean;
  isOwner: boolean;
};

export type ThemeName = 'classic' | 'warm' | 'night';
