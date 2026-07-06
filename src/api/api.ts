// Типизированные функции для всех эндпоинтов API.
import { http } from './http';

// ─── Типы ответов API ────────────────────────────────────────────────────────

export type ApiUser = {
  id: string;
  name: string; // вычисляемое сервером «Имя Фамилия»
  lastName: string;
  firstName: string;
  middleName: string | null;
  handle: string;
  email: string;
};
export type ApiTokens = { accessToken: string; refreshToken: string };

export type ApiTripSummary = {
  id: string;
  name: string;
  cur: string;
  ownerId: string;
  start: string | null;
  end: string | null;
  version: number;
};

export type ApiExpenseShare = {
  participantId: string;
  weight?: number | null;
  amount?: number | null;
};

export type ApiExpense = {
  id: string;
  title: string;
  amount: number;
  payer: string;
  splitType: number;
  share: ApiExpenseShare[];
  createdBy: string;
};

export type ApiTripEvent = {
  id: string;
  title: string;
  date: string;
  time: string | null;
  endTime: string | null;
  createdBy: string;
};

export type ApiGuest = {
  id: string;
  name: string; // вычисляемое сервером «Имя Фамилия»
  lastName: string;
  firstName: string;
  middleName: string | null;
};

export type ApiTripDetail = ApiTripSummary & {
  members: ApiUser[];
  guests: ApiGuest[];
  expenses: ApiExpense[];
  events: ApiTripEvent[];
};

export type ApiFriendDto = {
  id: string;
  name: string;
  lastName?: string | null;
  firstName?: string | null;
  middleName?: string | null;
  handle: string;
  email?: string;
};

export type ApiSettlements = {
  balances: Record<string, number>;
  transactions: { from: string; to: string; amount: number }[];
};

// ─── Аутентификация ──────────────────────────────────────────────────────────

export const auth = {
  register: (body: {
    lastName: string;
    firstName: string;
    middleName: string | null;
    handle: string;
    email: string;
    password: string;
  }) => http.post<{ user: ApiUser; tokens: ApiTokens }>('/auth/register', body),

  login: (email: string, password: string) =>
    http.post<{ user: ApiUser; tokens: ApiTokens }>('/auth/login', { email, password }),

  refresh: (refreshToken: string) =>
    http.post<{ user: ApiUser; accessToken: string; refreshToken: string }>('/auth/refresh', { refreshToken }),

  logout: (refreshToken: string) =>
    http.post<{ message: string }>('/auth/logout', { refreshToken }),

  me: () => http.get<{ user: ApiUser }>('/auth/me'),
};

// ─── Поездки ─────────────────────────────────────────────────────────────────

export const trips = {
  list: () => http.get<{ trips: ApiTripSummary[] }>('/trips'),

  create: (name: string, cur: string) =>
    http.post<{ trip: ApiTripSummary }>('/trips', { name, cur }),

  get: (tripId: string) =>
    http.get<{ trip: ApiTripDetail }>(`/trips/${tripId}`),

  patch: (tripId: string, body: { name?: string; start?: string | null; end?: string | null }, version: number) =>
    http.patch<{ trip: ApiTripSummary }>(`/trips/${tripId}`, body, { 'If-Match': String(version) }),

  clear: (tripId: string) =>
    http.post<{ message: string }>(`/trips/${tripId}/clear`),

  delete: (tripId: string) =>
    http.delete<{ message: string }>(`/trips/${tripId}`),

  // ─── Участники ───────────────────────────────────────────────────────────

  addMember: (tripId: string, userId: string) =>
    http.post<{ member: ApiUser }>(`/trips/${tripId}/members`, { userId }),

  addGuest: (tripId: string, body: { lastName: string; firstName: string; middleName: string | null }) =>
    http.post<{ guest: ApiGuest }>(`/trips/${tripId}/guests`, body),

  removeParticipant: (tripId: string, participantId: string) =>
    http.delete<{ message: string }>(`/trips/${tripId}/participants/${participantId}`),

  // ─── Расходы ─────────────────────────────────────────────────────────────

  addExpense: (tripId: string, title: string, amount: number, payer: string, splitType: number, share: ApiExpenseShare[]) =>
    http.post<{ expense: ApiExpense }>(`/trips/${tripId}/expenses`, { title, amount, payer, splitType, share }),

  removeExpense: (tripId: string, expenseId: string) =>
    http.delete<{ message: string }>(`/trips/${tripId}/expenses/${expenseId}`),

  getSettlements: (tripId: string) =>
    http.get<ApiSettlements>(`/trips/${tripId}/settlements`),

  // ─── События ─────────────────────────────────────────────────────────────

  addEvent: (tripId: string, title: string, date: string, time: string | null, endTime: string | null) =>
    http.post<{ event: ApiTripEvent }>(`/trips/${tripId}/events`, { title, date, time, endTime }),

  removeEvent: (tripId: string, eventId: string) =>
    http.delete<{ message: string }>(`/trips/${tripId}/events/${eventId}`),

  getCalendarUrl: (tripId: string) =>
    http.get<{ url: string; httpsUrl: string }>(`/trips/${tripId}/calendar-url`),

  getCalendarIcs: async (tripId: string): Promise<Blob> => {
    const at = (await import('./tokens')).getAccessToken();
    const base = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:5010';
    const res = await fetch(`${base}/trips/${tripId}/calendar.ics`, {
      headers: at ? { Authorization: `Bearer ${at}` } : {},
    });
    if (!res.ok) throw new Error('Не удалось получить .ics файл');
    return res.blob();
  },
};

// ─── Друзья ──────────────────────────────────────────────────────────────────

export const friends = {
  list: () =>
    http.get<{ friends: ApiFriendDto[]; incoming: ApiFriendDto[]; outgoing: ApiFriendDto[] }>('/me/friends'),

  searchByHandle: (handle: string) =>
    http.get<{ user: ApiUser }>(`/users/search?handle=${encodeURIComponent(handle)}`),

  sendRequest: (handleOrUserId: string) => {
    const isHandle = !handleOrUserId.startsWith('u_');
    return http.post<{ message: string }>('/me/friends/requests', isHandle
      ? { handle: handleOrUserId.replace(/^@+/, '') }
      : { userId: handleOrUserId });
  },

  accept: (userId: string) =>
    http.post<{ message: string }>(`/me/friends/requests/${userId}/accept`),

  decline: (userId: string) =>
    http.post<{ message: string }>(`/me/friends/requests/${userId}/decline`),

  remove: (userId: string) =>
    http.delete<{ message: string }>(`/me/friends/${userId}`),
};

// ─── Push-уведомления ────────────────────────────────────────────────────────

export const push = {
  getVapidKey: () =>
    http.get<{ publicKey: string }>('/notifications/vapid-public-key'),

  subscribe: (endpoint: string, p256dh: string, authKey: string) =>
    http.post<{ message: string }>('/notifications/subscribe', { endpoint, p256dh, auth: authKey }),

  unsubscribe: (endpoint: string) =>
    http.delete<{ message: string }>('/notifications/subscribe', { endpoint }),
};
