// Маппинг между DTO API и доменными типами фронтенда.
import type { Expense, Guest, SplitType, Trip, TripEvent, User } from '../types';
import type { ApiExpense, ApiFriendDto, ApiGuest, ApiTripDetail, ApiTripEvent, ApiUser } from './api';

// Валюта: API использует коды (RUB), фронтенд — глифы (₽).
const CODE_TO_GLYPH: Record<string, string> = {
  RUB: '₽', USD: '$', EUR: '€', KZT: '₸', UAH: '₴',
};
export const GLYPH_TO_CODE: Record<string, string> = {
  '₽': 'RUB', '$': 'USD', '€': 'EUR', '₸': 'KZT', '₴': 'UAH',
};

export function curToGlyph(code: string): string {
  return CODE_TO_GLYPH[code] ?? code;
}

export function curToCode(glyph: string): string {
  return GLYPH_TO_CODE[glyph] ?? glyph;
}

// ─── API User → Domain User ───────────────────────────────────────────────────

export function mapApiUser(u: ApiUser, friendData?: {
  friends: string[];
  incoming: string[];
  outgoing: string[];
}): User {
  return {
    id: u.id,
    name: u.name,
    handle: u.handle,
    email: u.email,
    pass: '',
    friends: friendData?.friends ?? [],
    incoming: friendData?.incoming ?? [],
    outgoing: friendData?.outgoing ?? [],
  };
}

export function mapFriendDto(f: ApiFriendDto): User {
  return { id: f.id, name: f.name, handle: f.handle, email: f.email ?? '', pass: '', friends: [], incoming: [], outgoing: [] };
}

// ─── API Trip → Domain Trip ───────────────────────────────────────────────────

export function mapApiExpense(e: ApiExpense): Expense {
  const splitType: SplitType = e.splitType === 1 ? 1 : e.splitType === 2 ? 2 : 0;
  return {
    id: e.id,
    title: e.title,
    amount: e.amount,
    payer: e.payer,
    splitType,
    share: e.share.map((s) => ({
      participantId: s.participantId,
      weight: s.weight ?? undefined,
      amount: s.amount ?? undefined,
    })),
    createdBy: e.createdBy,
  };
}

function mapApiGuest(g: ApiGuest): Guest {
  return { id: g.id, name: g.name };
}

function mapApiEvent(e: ApiTripEvent): TripEvent {
  return {
    id: e.id,
    title: e.title,
    date: e.date,
    time: e.time ?? '',
    endTime: e.endTime ?? '',
    createdBy: e.createdBy,
  };
}

export function mapApiTripDetail(t: ApiTripDetail): { trip: Trip; users: Record<string, User> } {
  const users: Record<string, User> = {};
  for (const m of t.members) {
    users[m.id] = mapApiUser(m);
  }

  const trip: Trip = {
    id: t.id,
    name: t.name,
    cur: curToGlyph(t.cur),
    ownerId: t.ownerId,
    start: t.start ?? '',
    end: t.end ?? '',
    version: t.version,
    members: t.members.map((m) => m.id),
    guests: t.guests.map(mapApiGuest),
    expenses: t.expenses.map(mapApiExpense),
    events: t.events.map(mapApiEvent),
  };

  return { trip, users };
}
