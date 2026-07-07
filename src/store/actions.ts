import type { DB, Expense, Guest, PaymentDetails, Trip, TripEvent, User } from '../types';

// Все мутации модели как дискриминированное объединение экшенов.
// Каждый маппится 1:1 на будущий вызов API. Валидация и UX-сообщения — в компонентах,
// здесь только применение изменений к { db, sessionUserId }.
export type Action =
  // Внешняя синхронизация (storage-событие / realtime)
  | { type: 'externalDB'; db: DB }
  // Аутентификация
  | { type: 'register'; user: User }
  | { type: 'setSession'; userId: string | null }
  // Профиль: обновление ФИО текущего пользователя (middleName: '' сбрасывает отчество)
  | { type: 'updateProfile'; lastName: string; firstName: string; middleName: string }
  // Друзья
  | { type: 'friendRequest'; fromId: string; toId: string }
  | { type: 'acceptFriend'; meId: string; fromId: string }
  | { type: 'declineFriend'; meId: string; fromId: string }
  | { type: 'removeFriend'; meId: string; friendId: string }
  // Поездки
  | { type: 'createTrip'; trip: Trip }
  | { type: 'deleteTrip'; tripId: string }
  | { type: 'renameTrip'; tripId: string; name: string }
  | { type: 'setTripStart'; tripId: string; start: string }
  | { type: 'setTripEnd'; tripId: string; end: string }
  | { type: 'clearTrip'; tripId: string }
  // Участники
  | { type: 'addMember'; tripId: string; userId: string }
  // id/name гостя приходят от сервера; компонент передаёт их пустыми, заполняет StoreContext.
  | { type: 'addGuest'; tripId: string; guest: Guest }
  // Обновление ФИО/реквизитов гостя. paymentDetails — задать; clearPayment — сбросить; ни того ни другого — не менять
  | { type: 'updateGuest'; tripId: string; guestId: string; lastName: string; firstName: string; middleName: string; paymentDetails?: PaymentDetails | null; clearPayment?: boolean }
  | { type: 'removeParticipant'; tripId: string; participantId: string }
  // Расходы
  | { type: 'addExpense'; tripId: string; expense: Expense }
  | { type: 'removeExpense'; tripId: string; expenseId: string }
  // События программы
  | { type: 'addEvent'; tripId: string; event: TripEvent }
  | { type: 'removeEvent'; tripId: string; eventId: string };
