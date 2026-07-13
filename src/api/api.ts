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
  // Общий бюджет (§4.4): id участника-спонсора. Приходит только в контексте
  // участника поездки (MemberDto); в auth-эндпоинтах поля нет.
  sponsorId?: string | null;
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
  status: string; // 'active' | 'settling' | 'settled'
  isArchived: boolean;
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
  isTransfer?: boolean;
  grossAmount?: number | null;
  discountPercent?: number | null;
  discountAmount?: number | null;
  sponsors?: Record<string, string> | null; // общий бюджет: снапшот пар этого расхода (§4.4)
};

// Скидка на расход: сумма до скидки + один из discountPercent/discountAmount (не оба сразу).
export type ExpenseDiscount = {
  grossAmount?: number;
  discountPercent?: number;
  discountAmount?: number;
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
  sponsorId?: string | null; // общий бюджет (§4.4)
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

export type ApiSettlementTx = {
  from: string;
  to: string;
  amount: number;
  // toPayment — реквизиты получателя (to), куда переводить; null, если у него их нет.
  toPayment?: ApiPaymentDetails | null;
  // id/isPaid/paidAt заполнены только после финализации (§5.5); при status 'active' — null.
  id?: string | null;
  isPaid?: boolean | null;
  paidAt?: string | null;
};

export type ApiSettlements = {
  status: string; // 'active' | 'settling' | 'settled'
  // Итоговые балансы после слияния общих бюджетов (§4.4): у подопечных всегда 0,
  // их долг/кредит перелит спонсору.
  balances: Record<string, number>;
  // Персональные балансы до слияния бюджетов; без спонсоров совпадает с balances.
  ownBalances?: Record<string, number>;
  transactions: ApiSettlementTx[];
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
  // archived: true — только архивные; иначе (по умолчанию) — только неархивные (§3.6).
  list: (archived?: boolean) =>
    http.get<{ trips: ApiTripSummary[] }>('/trips' + (archived ? '?archived=true' : '')),

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

  // Архивация (§3.6) — доступна любому участнику, ничем не блокируется. Ответ — полный
  // TripDetail; сервер шлёт trip:updated по SignalR.
  archive: (tripId: string) =>
    http.post<{ trip: ApiTripDetail }>(`/trips/${tripId}/archive`),

  unarchive: (tripId: string) =>
    http.post<{ trip: ApiTripDetail }>(`/trips/${tripId}/unarchive`),

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

  // Общий бюджет (§4.4): назначить себя спонсором участника (sponsorId = id текущего
  // юзера) или снять (null). Ответ — полный TripDetail; сервер шлёт trip:updated.
  setSponsor: (tripId: string, participantId: string, sponsorId: string | null) =>
    http.patch<{ trip: ApiTripDetail }>(`/trips/${tripId}/participants/${participantId}/sponsor`, { sponsorId }),

  // ─── Расходы ─────────────────────────────────────────────────────────────

  // sponsors (§4.4): не передан — сервер сам снапшотит живое спонсорство поездки;
  // передан — используется как есть (только пары из живого спонсорства, иначе 422 INVALID_SPONSORS).
  addExpense: (tripId: string, title: string, amount: number, payer: string, splitType: number, share: ApiExpenseShare[], discount?: ExpenseDiscount, sponsors?: Record<string, string>) =>
    http.post<{ expense: ApiExpense }>(`/trips/${tripId}/expenses`, { title, amount, payer, splitType, share, ...discount, sponsors }),

  // Полная замена расхода (как у addExpense) — частичного PATCH здесь нет.
  // Исключение — sponsors: не передан = оставить карту расхода как есть; передан —
  // заменяет целиком (пары из живого спонсорства ПЛЮС уже записанные на расходе).
  // warning: "TRIP_HAS_PAID_TRANSFERS" — в поездке уже есть оплаченные переводы,
  // правка может пересчитать чей-то остаток долга (не ошибка, 200 OK).
  patchExpense: (tripId: string, expenseId: string, title: string, amount: number, payer: string, splitType: number, share: ApiExpenseShare[], discount?: ExpenseDiscount, sponsors?: Record<string, string>) =>
    http.patch<{ expense: ApiExpense; warning: string | null }>(`/trips/${tripId}/expenses/${expenseId}`, { title, amount, payer, splitType, share, ...discount, sponsors }),

  removeExpense: (tripId: string, expenseId: string) =>
    http.delete<{ message: string }>(`/trips/${tripId}/expenses/${expenseId}`),

  getSettlements: (tripId: string) =>
    http.get<ApiSettlements>(`/trips/${tripId}/settlements`),

  // ─── Финализация подсчёта (§5.5) ────────────────────────────────────────

  // Завершить подсчёт (только владелец): фиксирует транзакции, статус → settling
  // (или сразу settled, если переводить нечего). Повторно — 409 ALREADY_FINALIZED.
  finalizeSettlement: (tripId: string) =>
    http.post<{ settlements: ApiSettlements }>(`/trips/${tripId}/settlement`),

  // Отметить оплату перевода (или снять отметку). До финализации — 409 NOT_FINALIZED.
  setTransactionPaid: (tripId: string, txId: string, paid: boolean) =>
    http.patch<{ settlements: ApiSettlements }>(`/trips/${tripId}/settlement/transactions/${txId}`, { paid }),

  // Переоткрыть подсчёт (только владелец): статус → active, неоплаченные транзакции
  // удаляются, оплаченные конвертируются в расходы-переводы (isTransfer).
  reopenSettlement: (tripId: string) =>
    http.post<{ settlements: ApiSettlements }>(`/trips/${tripId}/settlement/reopen`),

  // ─── Мои реквизиты в поездке (override поверх профиля) ────────────────────

  getMyPayment: (tripId: string) =>
    http.get<ApiTripPayment>(`/trips/${tripId}/me/payment`),

  // payment: null — сбросить override (реквизиты снова из профиля).
  setMyPayment: (tripId: string, payment: ApiPaymentDetails | null) =>
    http.patch<ApiTripPayment>(`/trips/${tripId}/me/payment`, { payment }),

  // ─── События ─────────────────────────────────────────────────────────────

  addEvent: (tripId: string, title: string, date: string, time: string | null, endTime: string | null) =>
    http.post<{ event: ApiTripEvent }>(`/trips/${tripId}/events`, { title, date, time, endTime }),

  // Полная замена события (как у addEvent) — частичного PATCH здесь нет.
  patchEvent: (tripId: string, eventId: string, title: string, date: string, time: string | null, endTime: string | null) =>
    http.patch<{ event: ApiTripEvent }>(`/trips/${tripId}/events/${eventId}`, { title, date, time, endTime }),

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

// ─── Что нового (What's New) ────────────────────────────────────────────────────

export type ApiRelease = {
  version: number;
  title: string;
  date?: string | null;
  items: string[];
};

export type ApiWhatsNew = {
  latestVersion: number;
  releases: ApiRelease[];
};

export const whatsNew = {
  // Публичный эндпоинт. since — версия, которую клиент уже видел (вернутся только релизы новее).
  // Без since отдаётся вся история изменений.
  get: (since?: number) =>
    http.get<{ whatsNew: ApiWhatsNew }>('/whats-new' + (since != null ? `?since=${since}` : '')),
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
