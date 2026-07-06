// Доменная модель приложения «Делим счёт».
// Соответствует Data Model из design_handoff_split_app/README.md.

export type User = {
  id: string; // 'u_' + random
  name: string; // вычисляемое сервером отображаемое имя: «Имя Фамилия» (без отчества)
  lastName: string; // фамилия (обязательна на сервере)
  firstName: string; // имя (обязательно на сервере)
  middleName: string; // отчество; '' если не указано
  handle: string; // УНИКАЛЬНЫЙ логин, lowercase, [a-z0-9_]{3,20}, без ведущего @
  email: string; // уникальный, используется только для входа
  pass: string; // TODO(auth): plaintext в прототипе — заменить на реальную аутентификацию (хэш на бэкенде)
  friends: string[]; // id пользователей (взаимные)
  incoming: string[]; // id пользователей, приславших МНЕ заявку
  outgoing: string[]; // id пользователей, которым заявку отправил я
};

// id 'g_' + random; без аккаунта. name — вычисляемое сервером «Имя Фамилия».
export type Guest = { id: string; name: string; lastName: string; firstName: string; middleName: string };

// Способ разбивки расхода: 0 — поровну, 1 — по частям (weight), 2 — точные суммы (amount).
export type SplitType = 0 | 1 | 2;

export type ExpenseShare = {
  participantId: string; // id участника (user или guest)
  weight?: number; // доля при splitType 1 (ByShares)
  amount?: number; // точная сумма при splitType 2 (ByAmounts)
};

export type Expense = {
  id: string;
  title: string;
  amount: number;
  payer: string; // id участника (user или guest)
  splitType: SplitType;
  share: ExpenseShare[]; // участники, между которыми делится расход
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
  fullName: string; // имя как введено — источник инициала фамилии при тёзках
  kind: 'friend' | 'guest';
  isMe: boolean;
  isOwner: boolean;
};

export type ThemeName = 'classic' | 'warm' | 'night';
