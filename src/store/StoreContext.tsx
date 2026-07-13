import { createContext, useCallback, useEffect, useReducer, useRef, useState, type ReactNode } from 'react';
import * as api from '../api/api';
import { connectHub, disconnectHub, onHubEvent } from '../api/signalr';
import { refreshOnce } from '../api/http';
import { clearTokens, getRefreshToken } from '../api/tokens';
import { mapApiGuest, mapApiTripDetail, mapApiUser, mapFriendDto, mapTripStatus, curToCode } from '../api/mappers';
import { reducer, type State } from './reducer';
import type { Action } from './actions';
import type { DB, Trip, User } from '../types';

export type AsyncDispatch = (action: Action) => Promise<{ warning?: string | null } | void>;

type StoreValue = State & {
  dispatch: AsyncDispatch;
  loading: boolean;
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
};

// eslint-disable-next-line react-refresh/only-export-components
export const StoreContext = createContext<StoreValue | null>(null);

function emptyDB(): DB {
  return { users: {}, trips: [] };
}

// ─── Bootstrap ───────────────────────────────────────────────────────────────

async function bootstrapFromApi(): Promise<State | null> {
  const rt = await getRefreshToken();
  if (!rt) return null;

  // Всегда обновляем AT через refresh-token перед API-запросами.
  // AT хранится только в памяти и сбрасывается при перезагрузке страницы.
  await refreshOnce();

  const [{ user }, { trips: activeSummaries }, { trips: archivedSummaries }, friendLists] = await Promise.all([
    api.auth.me(),
    api.trips.list(),
    api.trips.list(true),
    api.friends.list(),
  ]);
  const summaries = [...activeSummaries, ...archivedSummaries];

  const users: Record<string, User> = {};

  // Текущий пользователь — с полными данными о друзьях.
  users[user.id] = mapApiUser(user, {
    friends: friendLists.friends.map((f) => f.id),
    incoming: friendLists.incoming.map((f) => f.id),
    outgoing: friendLists.outgoing.map((f) => f.id),
  });

  // Друзья (минимальный профиль).
  for (const f of [...friendLists.friends, ...friendLists.incoming, ...friendLists.outgoing]) {
    if (!users[f.id]) users[f.id] = mapFriendDto(f);
  }

  // Загружаем детали каждой поездки (члены, расходы, события).
  const tripDetails = await Promise.all(summaries.map((s) => api.trips.get(s.id)));

  const domainTrips: Trip[] = [];
  for (const { trip } of tripDetails) {
    const { trip: domainTrip, users: tripUsers } = mapApiTripDetail(trip);
    domainTrips.push(domainTrip);
    // Не перезаписываем пользователей, уже загруженных с полными данными (friends/incoming/outgoing).
    for (const [id, u] of Object.entries(tripUsers)) {
      if (!users[id]) users[id] = u;
    }
  }

  return { db: { users, trips: domainTrips }, sessionUserId: user.id };
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, _dispatch] = useReducer(reducer, { db: emptyDB(), sessionUserId: null });
  const [loading, setLoading] = useState(true);
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  });

  // Тема — остаётся в localStorage (не требует бэкенда).
  useEffect(() => {
    // no-op: тема управляется ThemeProvider отдельно
  }, []);

  // ─── Асинхронная инициализация ──────────────────────────────────────────────

  const refreshSession = useCallback(async () => {
    try {
      const s = await bootstrapFromApi();
      if (s) {
        _dispatch({ type: 'externalDB', db: s.db });
        _dispatch({ type: 'setSession', userId: s.sessionUserId });
        connectHub().catch(() => {});
      } else {
        _dispatch({ type: 'setSession', userId: null });
      }
    } catch (e) {
      const status = (e instanceof Error && 'status' in e) ? (e as { status: number }).status : 0;
      if (status === 401 || status === 403 || status === 422) {
        await clearTokens();
      }
      _dispatch({ type: 'setSession', userId: null });
    }
  }, []);

  useEffect(() => {
    refreshSession().finally(() => setLoading(false));
  }, [refreshSession]);

  // ─── SignalR realtime ────────────────────────────────────────────────────────

  // Мёрджит пользователей из поездки с текущим store, не перезаписывая текущего
  // пользователя — у него есть friends/incoming/outgoing, у trip-member их нет.
  const mergeUsers = (existing: Record<string, User>, incoming: Record<string, User>) => {
    const meId = stateRef.current.sessionUserId;
    const merged = { ...existing, ...incoming };
    if (meId && existing[meId]) merged[meId] = existing[meId];
    return merged;
  };

  useEffect(() => {
    return onHubEvent((event) => {
      const sid = stateRef.current.sessionUserId;
      if (!sid) return;

      switch (event.type) {
        case 'trip:updated': {
          const { id: tripId } = event.payload;
          if (tripId) {
            api.trips.get(tripId).then(({ trip }) => {
              const { trip: dt, users } = mapApiTripDetail(trip);
              const cur = stateRef.current;
              _dispatch({
                type: 'externalDB',
                db: {
                  ...cur.db,
                  users: mergeUsers(cur.db.users, users),
                  trips: cur.db.trips.map((t) => (t.id === dt.id ? dt : t)),
                },
              });
            }).catch(() => {});
          }
          break;
        }
        case 'trip:deleted': {
          _dispatch({ type: 'deleteTrip', tripId: event.payload.tripId });
          break;
        }
        case 'trip:joined': {
          const { tripId } = event.payload;
          api.trips.get(tripId).then(({ trip }) => {
            const { trip: dt, users } = mapApiTripDetail(trip);
            const cur = stateRef.current;
            _dispatch({
              type: 'externalDB',
              db: {
                ...cur.db,
                users: mergeUsers(cur.db.users, users),
                trips: cur.db.trips.some((t) => t.id === dt.id) ? cur.db.trips : [...cur.db.trips, dt],
              },
            });
          }).catch(() => {});
          break;
        }
        case 'expense:added': {
          const { tripId } = event.payload;
          api.trips.get(tripId).then(({ trip }) => {
            const { trip: dt, users } = mapApiTripDetail(trip);
            const cur = stateRef.current;
            _dispatch({
              type: 'externalDB',
              db: {
                ...cur.db,
                users: mergeUsers(cur.db.users, users),
                trips: cur.db.trips.map((t) => (t.id === dt.id ? dt : t)),
              },
            });
          }).catch(() => {});
          break;
        }
        case 'expense:updated': {
          const { tripId } = event.payload;
          api.trips.get(tripId).then(({ trip }) => {
            const { trip: dt, users } = mapApiTripDetail(trip);
            const cur = stateRef.current;
            _dispatch({
              type: 'externalDB',
              db: {
                ...cur.db,
                users: mergeUsers(cur.db.users, users),
                trips: cur.db.trips.map((t) => (t.id === dt.id ? dt : t)),
              },
            });
          }).catch(() => {});
          break;
        }
        case 'expense:removed': {
          const { tripId, expenseId } = event.payload;
          _dispatch({ type: 'removeExpense', tripId, expenseId });
          break;
        }
        case 'event:added': {
          const { tripId } = event.payload;
          api.trips.get(tripId).then(({ trip }) => {
            const { trip: dt, users } = mapApiTripDetail(trip);
            const cur = stateRef.current;
            _dispatch({
              type: 'externalDB',
              db: {
                ...cur.db,
                users: mergeUsers(cur.db.users, users),
                trips: cur.db.trips.map((t) => (t.id === dt.id ? dt : t)),
              },
            });
          }).catch(() => {});
          break;
        }
        case 'event:updated': {
          const { tripId } = event.payload;
          api.trips.get(tripId).then(({ trip }) => {
            const { trip: dt, users } = mapApiTripDetail(trip);
            const cur = stateRef.current;
            _dispatch({
              type: 'externalDB',
              db: {
                ...cur.db,
                users: mergeUsers(cur.db.users, users),
                trips: cur.db.trips.map((t) => (t.id === dt.id ? dt : t)),
              },
            });
          }).catch(() => {});
          break;
        }
        case 'event:removed': {
          const { tripId, eventId } = event.payload;
          _dispatch({ type: 'removeEvent', tripId, eventId });
          break;
        }
        case 'settlement:updated': {
          // Транзакции/балансы применяет useSettlements собственной подпиской;
          // здесь обновляем только trip.status. Переход в active (reopen) добавляет
          // на сервере расходы-переводы, которых нет в payload — полный рефетч.
          const { tripId, settlements } = event.payload;
          const status = mapTripStatus(settlements.status);
          const curTrip = stateRef.current.db.trips.find((t) => t.id === tripId);
          if (!curTrip || curTrip.status === status) break;
          if (status === 'active') {
            api.trips.get(tripId).then(({ trip }) => {
              const { trip: dt, users } = mapApiTripDetail(trip);
              const cur = stateRef.current;
              _dispatch({
                type: 'externalDB',
                db: {
                  ...cur.db,
                  users: mergeUsers(cur.db.users, users),
                  trips: cur.db.trips.map((t) => (t.id === dt.id ? dt : t)),
                },
              });
            }).catch(() => {});
          } else {
            const cur = stateRef.current;
            _dispatch({
              type: 'externalDB',
              db: {
                ...cur.db,
                trips: cur.db.trips.map((t) => (t.id === tripId ? { ...t, status } : t)),
              },
            });
          }
          break;
        }
        case 'member:added': {
          const { tripId, id: userId } = event.payload;
          _dispatch({ type: 'addMember', tripId, userId });
          break;
        }
        case 'participant:removed': {
          const { tripId, participantId } = event.payload;
          api.trips.get(tripId).then(({ trip }) => {
            const { trip: dt, users } = mapApiTripDetail(trip);
            const cur = stateRef.current;
            _dispatch({
              type: 'externalDB',
              db: {
                ...cur.db,
                users: mergeUsers(cur.db.users, users),
                trips: cur.db.trips.map((t) => (t.id === dt.id ? dt : t)),
              },
            });
          }).catch(() => refreshSession());
          void participantId;
          break;
        }
        case 'friend:accepted': {
          const friend = event.payload;
          const cur = stateRef.current;
          const me = cur.db.users[sid];
          if (!me) break;
          const newFriend = { id: friend.id, name: friend.name, lastName: friend.lastName ?? '', firstName: friend.firstName ?? '', middleName: friend.middleName ?? '', handle: friend.handle, email: friend.email, pass: '', friends: [], incoming: [], outgoing: [] };
          _dispatch({
            type: 'externalDB',
            db: {
              ...cur.db,
              users: {
                ...cur.db.users,
                [friend.id]: newFriend,
                [sid]: {
                  ...me,
                  friends: me.friends.includes(friend.id) ? me.friends : [...me.friends, friend.id],
                  outgoing: me.outgoing.filter((x) => x !== friend.id),
                },
              },
            },
          });
          break;
        }
        case 'friend:request': {
          const requester = event.payload;
          const cur = stateRef.current;
          const me = cur.db.users[sid];
          if (!me) break;
          const newRequester = { id: requester.id, name: requester.name, lastName: requester.lastName ?? '', firstName: requester.firstName ?? '', middleName: requester.middleName ?? '', handle: requester.handle, email: requester.email, pass: '', friends: [], incoming: [], outgoing: [] };
          _dispatch({
            type: 'externalDB',
            db: {
              ...cur.db,
              users: {
                ...cur.db.users,
                [requester.id]: newRequester,
                [sid]: {
                  ...me,
                  incoming: me.incoming.includes(requester.id) ? me.incoming : [...me.incoming, requester.id],
                },
              },
            },
          });
          break;
        }
        default:
          break;
      }
    });
  }, [refreshSession]);

  // ─── Logout ──────────────────────────────────────────────────────────────────

  const logout = useCallback(async () => {
    const rt = await getRefreshToken();
    if (rt) {
      try { await api.auth.logout(rt); } catch { /* ignore */ }
    }
    await clearTokens();
    disconnectHub().catch(() => {});
    _dispatch({ type: 'externalDB', db: emptyDB() });
    _dispatch({ type: 'setSession', userId: null });
  }, []);

  // ─── Debounce для rename/setDates ────────────────────────────────────────────

  const _renameTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const _datesTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  // ─── Async dispatch ───────────────────────────────────────────────────────────

  const dispatch = useCallback<AsyncDispatch>(async (action) => {
    const st = stateRef.current;

    switch (action.type) {
      // ── Аутентификация (обрабатывается через refreshSession / AuthPage) ──────
      case 'register':
      case 'setSession':
      case 'externalDB':
        _dispatch(action);
        return;

      // ── Синхронизация ──────────────────────────────────────────────────────

      case 'refetchTrip': {
        const { trip: fresh } = await api.trips.get(action.tripId);
        const { trip: dt, users } = mapApiTripDetail(fresh);
        const cur = stateRef.current;
        _dispatch({
          type: 'externalDB',
          db: {
            ...cur.db,
            users: mergeUsers(cur.db.users, users),
            trips: cur.db.trips.map((t) => (t.id === dt.id ? dt : t)),
          },
        });
        return;
      }

      // ── Профиль ────────────────────────────────────────────────────────────

      case 'updateProfile': {
        // middleName: '' сбрасывает отчество на сервере (не опускаем).
        const { user } = await api.auth.updateMe({
          lastName: action.lastName,
          firstName: action.firstName,
          middleName: action.middleName,
        });
        const cur = stateRef.current;
        const existing = cur.db.users[user.id];
        // Сохраняем friends/incoming/outgoing текущего пользователя — PATCH их не возвращает.
        const updated = mapApiUser(user, existing
          ? { friends: existing.friends, incoming: existing.incoming, outgoing: existing.outgoing }
          : undefined);
        _dispatch({
          type: 'externalDB',
          db: { ...cur.db, users: { ...cur.db.users, [user.id]: updated } },
        });
        return;
      }

      // ── Друзья ─────────────────────────────────────────────────────────────

      case 'friendRequest': {
        await api.friends.sendRequest(action.toId.startsWith('u_') ? action.toId : action.toId);
        _dispatch(action);
        // Синхронизируем friend-списки (auto-accept на сервере меняет обе стороны).
        await refreshSession();
        return;
      }

      case 'acceptFriend': {
        await api.friends.accept(action.fromId);
        _dispatch(action);
        await refreshSession();
        return;
      }

      case 'declineFriend': {
        await api.friends.decline(action.fromId);
        _dispatch(action);
        return;
      }

      case 'removeFriend': {
        await api.friends.remove(action.friendId);
        _dispatch(action);
        return;
      }

      // ── Поездки ────────────────────────────────────────────────────────────

      case 'createTrip': {
        const curCode = curToCode(action.trip.cur);
        const { trip: summary } = await api.trips.create(action.trip.name, curCode);
        // Если заданы даты — сразу патчим.
        let finalSummary = summary;
        if (action.trip.start || action.trip.end) {
          try {
            const { trip: patched } = await api.trips.patch(
              summary.id,
              { start: action.trip.start || null, end: action.trip.end || null },
              summary.version,
            );
            finalSummary = patched;
          } catch { /* игнорируем, поездка создана без дат */ }
        }
        const { trip: detail } = await api.trips.get(finalSummary.id);
        const { trip: domainTrip, users } = mapApiTripDetail(detail);
        _dispatch({
          type: 'externalDB',
          db: {
            ...st.db,
            users: mergeUsers(st.db.users, users),
            trips: [domainTrip, ...st.db.trips],
          },
        });
        return;
      }

      case 'deleteTrip': {
        await api.trips.delete(action.tripId);
        _dispatch(action);
        return;
      }

      case 'renameTrip': {
        // Оптимистичный апдейт сразу, API — с дебаунсом (вводим посимвольно).
        _dispatch(action);
        const map = _renameTimers.current;
        if (map.has(action.tripId)) clearTimeout(map.get(action.tripId)!);
        map.set(action.tripId, setTimeout(async () => {
          map.delete(action.tripId);
          const trip = stateRef.current.db.trips.find((t) => t.id === action.tripId);
          if (!trip) return;
          try {
            await api.trips.patch(action.tripId, { name: stateRef.current.db.trips.find(t => t.id === action.tripId)?.name }, trip.version ?? 0);
          } catch (e) {
            // VERSION_CONFLICT — перезагружаем поездку
            const err = e as { code?: string };
            if (err?.code === 'VERSION_CONFLICT') {
              const { trip: fresh } = await api.trips.get(action.tripId).catch(() => ({ trip: null }));
              if (fresh) {
                const { trip: dt, users } = mapApiTripDetail(fresh);
                _dispatch({ type: 'externalDB', db: { ...stateRef.current.db, users: { ...stateRef.current.db.users, ...users }, trips: stateRef.current.db.trips.map(t => t.id === dt.id ? dt : t) } });
              }
            }
          }
        }, 600));
        return;
      }

      case 'setTripStart':
      case 'setTripEnd': {
        _dispatch(action);
        const dmap = _datesTimers.current;
        if (dmap.has(action.tripId)) clearTimeout(dmap.get(action.tripId)!);
        dmap.set(action.tripId, setTimeout(async () => {
          dmap.delete(action.tripId);
          const trip = stateRef.current.db.trips.find((t) => t.id === action.tripId);
          if (!trip) return;
          try {
            const { trip: updated } = await api.trips.patch(
              action.tripId,
              { start: trip.start || null, end: trip.end || null },
              trip.version ?? 0,
            );
            _dispatch({
              type: 'externalDB',
              db: { ...stateRef.current.db, trips: stateRef.current.db.trips.map(t => t.id === updated.id ? { ...t, version: updated.version } : t) },
            });
          } catch { /* игнорируем */ }
        }, 400));
        return;
      }

      case 'clearTrip': {
        await api.trips.clear(action.tripId);
        // Перезагружаем детали поездки (каскад затрагивает expenses/guests).
        const { trip: fresh } = await api.trips.get(action.tripId);
        const { trip: dt, users } = mapApiTripDetail(fresh);
        _dispatch({
          type: 'externalDB',
          db: {
            ...st.db,
            users: mergeUsers(st.db.users, users),
            trips: st.db.trips.map((t) => (t.id === dt.id ? dt : t)),
          },
        });
        return;
      }

      case 'archiveTrip':
      case 'unarchiveTrip': {
        const { trip: fresh } = action.type === 'archiveTrip'
          ? await api.trips.archive(action.tripId)
          : await api.trips.unarchive(action.tripId);
        const { trip: dt, users } = mapApiTripDetail(fresh);
        _dispatch({
          type: 'externalDB',
          db: {
            ...st.db,
            users: mergeUsers(st.db.users, users),
            trips: st.db.trips.map((t) => (t.id === dt.id ? dt : t)),
          },
        });
        return;
      }

      // ── Участники ──────────────────────────────────────────────────────────

      case 'addMember': {
        await api.trips.addMember(action.tripId, action.userId);
        const memberUser = st.db.users[action.userId];
        if (memberUser) _dispatch(action);
        return;
      }

      case 'addGuest': {
        const g = action.guest;
        const { guest } = await api.trips.addGuest(action.tripId, {
          lastName: g.lastName,
          firstName: g.firstName,
          middleName: g.middleName || null,
          paymentDetails: g.paymentDetails ?? null,
        });
        // Используем id и вычисленное name от сервера, не локальные.
        _dispatch({ type: 'addGuest', tripId: action.tripId, guest: mapApiGuest(guest) });
        return;
      }

      case 'updateGuest': {
        await api.trips.patchGuest(action.tripId, action.guestId, {
          lastName: action.lastName,
          firstName: action.firstName,
          middleName: action.middleName,
          paymentDetails: action.paymentDetails ?? undefined,
          clearPayment: action.clearPayment,
        });
        // Сервер шлёт trip:updated по SignalR (тот же полный рефетч); делаем его же для мгновенности.
        const { trip: fresh } = await api.trips.get(action.tripId);
        const { trip: dt, users } = mapApiTripDetail(fresh);
        const cur = stateRef.current;
        _dispatch({
          type: 'externalDB',
          db: {
            ...cur.db,
            users: mergeUsers(cur.db.users, users),
            trips: cur.db.trips.map((t) => (t.id === dt.id ? dt : t)),
          },
        });
        return;
      }

      case 'removeParticipant': {
        // Сервер блокирует удаление 409 PARTICIPANT_HAS_EXPENSES, если участник есть
        // в расходах (нет каскадного удаления) — ошибка пробрасывается вызывающей стороне.
        await api.trips.removeParticipant(action.tripId, action.participantId);
        const { trip: fresh } = await api.trips.get(action.tripId);
        const { trip: dt, users } = mapApiTripDetail(fresh);
        _dispatch({
          type: 'externalDB',
          db: {
            ...st.db,
            users: mergeUsers(st.db.users, users),
            trips: st.db.trips.map((t) => (t.id === dt.id ? dt : t)),
          },
        });
        return;
      }

      case 'setSponsor': {
        // Правила (SPONSOR_SELF/CHAIN/TAKEN, NOT_SPONSOR, TRIP_SETTLING) проверяет сервер —
        // ошибка пробрасывается вызывающей стороне. Ответ несёт полный TripDetail,
        // применяем его напрямую (SignalR trip:updated сделает тот же полный апдейт).
        const { trip } = await api.trips.setSponsor(action.tripId, action.participantId, action.sponsorId);
        const { trip: dt, users } = mapApiTripDetail(trip);
        const cur = stateRef.current;
        _dispatch({
          type: 'externalDB',
          db: {
            ...cur.db,
            users: mergeUsers(cur.db.users, users),
            trips: cur.db.trips.map((t) => (t.id === dt.id ? dt : t)),
          },
        });
        return;
      }

      // ── Расходы ────────────────────────────────────────────────────────────

      case 'addExpense': {
        // sponsors: undefined = сервер сам снапшотит живое спонсорство поездки (обычный случай).
        await api.trips.addExpense(
          action.tripId,
          action.expense.title,
          action.expense.amount,
          action.expense.payer,
          action.expense.splitType,
          action.expense.share,
          {
            grossAmount: action.expense.grossAmount,
            discountPercent: action.expense.discountPercent,
            discountAmount: action.expense.discountAmount,
          },
          action.expense.sponsors,
        );
        const { trip: freshE } = await api.trips.get(action.tripId);
        const { trip: dtE, users: usersE } = mapApiTripDetail(freshE);
        const curE = stateRef.current;
        _dispatch({
          type: 'externalDB',
          db: {
            ...curE.db,
            users: mergeUsers(curE.db.users, usersE),
            trips: curE.db.trips.map((t) => (t.id === dtE.id ? dtE : t)),
          },
        });
        return;
      }

      case 'editExpense': {
        // sponsors: undefined = не менять карту расхода (форма передаёт её только при изменении).
        const { warning } = await api.trips.patchExpense(
          action.tripId,
          action.expense.id,
          action.expense.title,
          action.expense.amount,
          action.expense.payer,
          action.expense.splitType,
          action.expense.share,
          {
            grossAmount: action.expense.grossAmount,
            discountPercent: action.expense.discountPercent,
            discountAmount: action.expense.discountAmount,
          },
          action.expense.sponsors,
        );
        const { trip: freshPE } = await api.trips.get(action.tripId);
        const { trip: dtPE, users: usersPE } = mapApiTripDetail(freshPE);
        const curPE = stateRef.current;
        _dispatch({
          type: 'externalDB',
          db: {
            ...curPE.db,
            users: mergeUsers(curPE.db.users, usersPE),
            trips: curPE.db.trips.map((t) => (t.id === dtPE.id ? dtPE : t)),
          },
        });
        return { warning };
      }

      case 'removeExpense': {
        await api.trips.removeExpense(action.tripId, action.expenseId);
        _dispatch(action);
        return;
      }

      // ── События программы ──────────────────────────────────────────────────

      case 'addEvent': {
        await api.trips.addEvent(
          action.tripId,
          action.event.title,
          action.event.date,
          action.event.time || null,
          action.event.endTime || null,
        );
        const { trip: freshEv } = await api.trips.get(action.tripId);
        const { trip: dtEv, users: usersEv } = mapApiTripDetail(freshEv);
        const curEv = stateRef.current;
        _dispatch({
          type: 'externalDB',
          db: {
            ...curEv.db,
            users: mergeUsers(curEv.db.users, usersEv),
            trips: curEv.db.trips.map((t) => (t.id === dtEv.id ? dtEv : t)),
          },
        });
        return;
      }

      case 'editEvent': {
        await api.trips.patchEvent(
          action.tripId,
          action.event.id,
          action.event.title,
          action.event.date,
          action.event.time || null,
          action.event.endTime || null,
        );
        const { trip: freshPEv } = await api.trips.get(action.tripId);
        const { trip: dtPEv, users: usersPEv } = mapApiTripDetail(freshPEv);
        const curPEv = stateRef.current;
        _dispatch({
          type: 'externalDB',
          db: {
            ...curPEv.db,
            users: mergeUsers(curPEv.db.users, usersPEv),
            trips: curPEv.db.trips.map((t) => (t.id === dtPEv.id ? dtPEv : t)),
          },
        });
        return;
      }

      case 'removeEvent': {
        await api.trips.removeEvent(action.tripId, action.eventId);
        _dispatch(action);
        return;
      }

      default:
        _dispatch(action as Parameters<typeof _dispatch>[0]);
    }
  }, [refreshSession]);

  return (
    <StoreContext.Provider value={{ ...state, dispatch, loading, logout, refreshSession }}>
      {children}
    </StoreContext.Provider>
  );
}
