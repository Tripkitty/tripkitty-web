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

// ─── Реквизиты / СБП ───────────────────────────────────────────────────────

export type ApiPaymentDetails = {
  phone: string;
  banks: string[];
  label: string | null;
};

export type ApiPaymentMethod = ApiPaymentDetails & {
  id: string;
  isDefault: boolean;
};

export type ApiBank = { code: string; name: string };

// source: 'trip' — задан override поездки; 'profile' — взят дефолт из профиля; 'none' — реквизитов нет.
export type ApiTripPayment = {
  payment: ApiPaymentDetails | null;
  source: 'trip' | 'profile' | 'none';
};

export type ApiGuest = {
  id: string;
  name: string; // вычисляемое сервером «Имя Фамилия»
  lastName: string;
  firstName: string;
  middleName: string | null;
  paymentDetails?: ApiPaymentDetails | null;
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
  // toPayment — реквизиты получателя (to), куда переводить; null, если у него их нет.
  transactions: { from: string; to: string; amount: number; toPayment?: ApiPaymentDetails | null }[];
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

  // Частичное обновление ФИО. Опущенное / null поле не меняется; middleName: '' сбрасывает отчество.
  updateMe: (body: { lastName?: string; firstName?: string; middleName?: string | null }) =>
    http.patch<{ user: ApiUser }>('/auth/me', body),
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

  addGuest: (tripId: string, body: {
    lastName: string;
    firstName: string;
    middleName: string | null;
    paymentDetails?: ApiPaymentDetails | null;
  }) =>
    http.post<{ guest: ApiGuest }>(`/trips/${tripId}/guests`, body),

  // Частичное обновление гостя (ФИО + реквизиты). Правила ФИО — как у updateMe.
  // paymentDetails задан → задать/заменить; clearPayment: true (без paymentDetails) → сбросить в null;
  // ни того, ни другого → реквизиты не меняются. If-Match не нужен.
  patchGuest: (tripId: string, guestId: string, body: {
    lastName?: string;
    firstName?: string;
    middleName?: string | null;
    paymentDetails?: ApiPaymentDetails | null;
    clearPayment?: boolean;
  }) =>
    http.patch<{ guest: ApiGuest }>(`/trips/${tripId}/guests/${guestId}`, body),

  removeParticipant: (tripId: string, participantId: string) =>
    http.delete<{ message: string }>(`/trips/${tripId}/participants/${participantId}`),

  // ─── Расходы ─────────────────────────────────────────────────────────────

  addExpense: (tripId: string, title: string, amount: number, payer: string, splitType: number, share: ApiExpenseShare[]) =>
    http.post<{ expense: ApiExpense }>(`/trips/${tripId}/expenses`, { title, amount, payer, splitType, share }),

  removeExpense: (tripId: string, expenseId: string) =>
    http.delete<{ message: string }>(`/trips/${tripId}/expenses/${expenseId}`),

  getSettlements: (tripId: string) =>
    http.get<ApiSettlements>(`/trips/${tripId}/settlements`),

  // ─── Мои реквизиты в поездке (override поверх профиля) ────────────────────

  getMyPayment: (tripId: string) =>
    http.get<ApiTripPayment>(`/trips/${tripId}/me/payment`),

  // payment: null — сбросить override (реквизиты снова из профиля).
  setMyPayment: (tripId: string, payment: ApiPaymentDetails | null) =>
    http.patch<ApiTripPayment>(`/trips/${tripId}/me/payment`, { payment }),

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

// ─── Справочник банков ─────────────────────────────────────────────────────────

export const banks = {
  // Без авторизации; коды: SBERBANK, TBANK, ALFABANK, VTB (и будущие).
  list: () => http.get<{ banks: ApiBank[] }>('/banks'),
};

// ─── Способы оплаты в профиле (СБП) ─────────────────────────────────────────────

export const paymentMethods = {
  list: () => http.get<{ paymentMethods: ApiPaymentMethod[] }>('/me/payment-methods'),

  create: (body: { phone: string; banks: string[]; label?: string | null; isDefault?: boolean }) =>
    http.post<{ paymentMethod: ApiPaymentMethod }>('/me/payment-methods', body),

  // Все поля опциональны — передаём только изменяемые.
  patch: (id: string, body: { phone?: string; banks?: string[]; label?: string | null; isDefault?: boolean }) =>
    http.patch<{ paymentMethod: ApiPaymentMethod }>(`/me/payment-methods/${id}`, body),

  remove: (id: string) =>
    http.delete<{ message: string }>(`/me/payment-methods/${id}`),
};
