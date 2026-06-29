import type { DB, Trip } from '../types';
import type { Action } from './actions';

export type State = { db: DB; sessionUserId: string | null };

// Хелпер: применить fn к нужной поездке, вернув новый db.
function updTrip(db: DB, tripId: string, fn: (t: Trip) => Trip): DB {
  return { ...db, trips: db.trips.map((t) => (t.id === tripId ? fn(t) : t)) };
}

export function reducer(state: State, action: Action): State {
  const { db } = state;
  switch (action.type) {
    case 'externalDB':
      return { ...state, db: action.db };

    case 'register':
      return {
        db: { ...db, users: { ...db.users, [action.user.id]: action.user } },
        sessionUserId: action.user.id,
      };

    case 'setSession':
      return { ...state, sessionUserId: action.userId };

    case 'friendRequest': {
      const users = { ...db.users };
      users[action.fromId] = { ...users[action.fromId], outgoing: [...users[action.fromId].outgoing, action.toId] };
      users[action.toId] = { ...users[action.toId], incoming: [...users[action.toId].incoming, action.fromId] };
      return { ...state, db: { ...db, users } };
    }

    case 'acceptFriend': {
      const { meId, fromId } = action;
      const users = { ...db.users };
      users[meId] = {
        ...users[meId],
        friends: [...users[meId].friends, fromId],
        incoming: users[meId].incoming.filter((x) => x !== fromId),
      };
      users[fromId] = {
        ...users[fromId],
        friends: [...users[fromId].friends, meId],
        outgoing: users[fromId].outgoing.filter((x) => x !== meId),
      };
      return { ...state, db: { ...db, users } };
    }

    case 'declineFriend': {
      const { meId, fromId } = action;
      const users = { ...db.users };
      users[meId] = { ...users[meId], incoming: users[meId].incoming.filter((x) => x !== fromId) };
      users[fromId] = { ...users[fromId], outgoing: users[fromId].outgoing.filter((x) => x !== meId) };
      return { ...state, db: { ...db, users } };
    }

    case 'removeFriend': {
      const { meId, friendId } = action;
      const users = { ...db.users };
      users[meId] = { ...users[meId], friends: users[meId].friends.filter((x) => x !== friendId) };
      users[friendId] = { ...users[friendId], friends: users[friendId].friends.filter((x) => x !== meId) };
      return { ...state, db: { ...db, users } };
    }

    case 'createTrip':
      return { ...state, db: { ...db, trips: [action.trip, ...db.trips] } };

    case 'deleteTrip':
      return { ...state, db: { ...db, trips: db.trips.filter((t) => t.id !== action.tripId) } };

    case 'renameTrip':
      return { ...state, db: updTrip(db, action.tripId, (t) => ({ ...t, name: action.name })) };

    case 'setTripStart':
      return { ...state, db: updTrip(db, action.tripId, (t) => ({ ...t, start: action.start })) };

    case 'setTripEnd':
      return { ...state, db: updTrip(db, action.tripId, (t) => ({ ...t, end: action.end })) };

    case 'clearTrip':
      return { ...state, db: updTrip(db, action.tripId, (t) => ({ ...t, expenses: [], guests: [] })) };

    case 'addMember':
      return {
        ...state,
        db: updTrip(db, action.tripId, (t) =>
          t.members.includes(action.userId) ? t : { ...t, members: [...t.members, action.userId] },
        ),
      };

    case 'addGuest':
      return {
        ...state,
        db: updTrip(db, action.tripId, (t) => ({
          ...t,
          guests: [...(t.guests || []), { id: action.id, name: action.name }],
        })),
      };

    case 'removeParticipant':
      return {
        ...state,
        db: updTrip(db, action.tripId, (t) => {
          const pid = action.participantId;
          const isGuest = (t.guests || []).some((g) => g.id === pid);
          return {
            ...t,
            members: isGuest ? t.members : t.members.filter((m) => m !== pid),
            guests: isGuest ? t.guests.filter((g) => g.id !== pid) : t.guests,
            // Удаление участника убирает его из всех расходов; расходы с опустевшим share отбрасываются.
            expenses: t.expenses
              .filter((e) => e.payer !== pid)
              .map((e) => ({ ...e, share: e.share.filter((x) => x !== pid) }))
              .filter((e) => e.share.length > 0),
          };
        }),
      };

    case 'addExpense':
      return {
        ...state,
        db: updTrip(db, action.tripId, (t) => ({ ...t, expenses: [action.expense, ...t.expenses] })),
      };

    case 'removeExpense':
      return {
        ...state,
        db: updTrip(db, action.tripId, (t) => ({ ...t, expenses: t.expenses.filter((e) => e.id !== action.expenseId) })),
      };

    case 'addEvent':
      return {
        ...state,
        db: updTrip(db, action.tripId, (t) => ({ ...t, events: [...(t.events || []), action.event] })),
      };

    case 'removeEvent':
      return {
        ...state,
        db: updTrip(db, action.tripId, (t) => ({ ...t, events: (t.events || []).filter((e) => e.id !== action.eventId) })),
      };

    default:
      return state;
  }
}
