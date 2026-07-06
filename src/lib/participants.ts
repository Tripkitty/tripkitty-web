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
        fullName: u.name,
        kind: 'friend',
        isMe: uid === sessionUserId,
        isOwner: uid === trip.ownerId,
      });
  });
  (trip.guests || []).forEach((g) =>
    ps.push({ id: g.id, name: disp(g.name), fullName: g.name, kind: 'guest', isMe: false, isOwner: false }),
  );
  return ps;
}

export type Disambiguation = {
  idDisp: Record<string, string>; // имя + инициал фамилии (всегда, если фамилия есть)
  idName: Record<string, string>; // idDisp + фолбэк-суффикс (только при коллизии)
  idSub: Record<string, string>; // только фолбэк-суффикс (@handle / «гость N»)
};

// Первая буква фамилии (второе слово полного имени): «Иванов» → «И.».
function surnameInitial(fullName: string): string {
  const words = fullName.trim().split(/\s+/);
  return words.length > 1 ? words[1].charAt(0).toUpperCase() + '.' : '';
}

// Короткое имя с инициалом фамилии: «Никита Иванов» → «Никита И.».
export function dispIni(fullName: string): string {
  const ini = surnameInitial(fullName);
  return ini ? disp(fullName) + ' ' + ini : disp(fullName);
}

// Отображаемое имя — всегда с инициалом фамилии, если она есть («Никита И.»).
// Фолбэк-суффикс @handle / «гость N» добавляется, только когда совпали и имя,
// и инициал (или у тёзок нет фамилий). Развитие логики renderVals().
export function disambiguate(ps: Participant[], users: DB['users']): Disambiguation {
  const idDisp: Record<string, string> = {};
  const dispCount: Record<string, number> = {};
  ps.forEach((p) => {
    const ini = surnameInitial(p.fullName);
    idDisp[p.id] = ini ? p.name + ' ' + ini : p.name;
    dispCount[idDisp[p.id]] = (dispCount[idDisp[p.id]] || 0) + 1;
  });
  const gIdx: Record<string, number> = {};
  const idName: Record<string, string> = {};
  const idSub: Record<string, string> = {};
  ps.forEach((p) => {
    let sub = '';
    if (dispCount[idDisp[p.id]] > 1) {
      if (p.kind === 'guest') {
        gIdx[idDisp[p.id]] = (gIdx[idDisp[p.id]] || 0) + 1;
        sub = 'гость ' + gIdx[idDisp[p.id]];
      } else {
        const u = users[p.id];
        sub = u && u.handle ? '@' + u.handle : '';
      }
    }
    idSub[p.id] = sub;
    idName[p.id] = sub ? idDisp[p.id] + ' · ' + sub : idDisp[p.id];
  });
  return { idDisp, idName, idSub };
}
