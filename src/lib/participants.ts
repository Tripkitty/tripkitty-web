import type { DB, Participant, Trip } from '../types';
import { disp } from './format';

// Унифицированный список участников поездки (members + guests). Порт из tripParticipants().
export function tripParticipants(trip: Trip, users: DB['users'], sessionUserId: string | null): Participant[] {
  const ps: Participant[] = [];
  trip.members.forEach((uid) => {
    const u = users[uid];
    if (u)
      ps.push({
        id: uid,
        name: disp(u.name),
        kind: 'friend',
        isMe: uid === sessionUserId,
        isOwner: uid === trip.ownerId,
      });
  });
  (trip.guests || []).forEach((g) =>
    ps.push({ id: g.id, name: disp(g.name), kind: 'guest', isMe: false, isOwner: false }),
  );
  return ps;
}

export type Disambiguation = {
  idName: Record<string, string>; // имя + суффикс (только при коллизии имён)
  idSub: Record<string, string>; // только суффикс (@handle / «гость N»)
};

// Дизамбигуация по @handle / «гость N»: суффикс добавляется ТОЛЬКО когда два участника
// делят одно display-имя. Порт логики из renderVals().
export function disambiguate(ps: Participant[], users: DB['users']): Disambiguation {
  const nameCount: Record<string, number> = {};
  ps.forEach((p) => {
    nameCount[p.name] = (nameCount[p.name] || 0) + 1;
  });
  const gIdx: Record<string, number> = {};
  const idName: Record<string, string> = {};
  const idSub: Record<string, string> = {};
  ps.forEach((p) => {
    let sub = '';
    if (nameCount[p.name] > 1) {
      if (p.kind === 'guest') {
        gIdx[p.name] = (gIdx[p.name] || 0) + 1;
        sub = 'гость ' + gIdx[p.name];
      } else {
        const u = users[p.id];
        sub = u && u.handle ? '@' + u.handle : '';
      }
    }
    idSub[p.id] = sub;
    idName[p.id] = sub ? p.name + ' · ' + sub : p.name;
  });
  return { idName, idSub };
}
