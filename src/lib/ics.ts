import type { DB, Trip } from '../types';
import { disp } from './format';
import { tripParticipants } from './participants';

// Экспорт программы поездки в .ics (VCALENDAR). Порт buildICS / exportICS — без изменений.

function icsEsc(s: unknown): string {
  return String(s == null ? '' : s)
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}
function icsDateOnly(d: string): string {
  return d.replace(/-/g, '');
}
function icsAddDay(d: string): string {
  const a = d.split('-');
  const dt = new Date(+a[0], +a[1] - 1, +a[2] + 1);
  const p = (n: number) => String(n).padStart(2, '0');
  return '' + dt.getFullYear() + p(dt.getMonth() + 1) + p(dt.getDate());
}
function icsDateTime(d: string, t: string): string {
  return d.replace(/-/g, '') + 'T' + t.replace(':', '') + '00';
}
function icsAddHour(t: string): string {
  const [h, m] = t.split(':').map(Number);
  const nh = (h + 1) % 24;
  const p = (n: number) => String(n).padStart(2, '0');
  return p(nh) + ':' + p(m);
}
function icsStamp(): string {
  const n = new Date();
  const p = (x: number) => String(x).padStart(2, '0');
  return (
    '' +
    n.getUTCFullYear() +
    p(n.getUTCMonth() + 1) +
    p(n.getUTCDate()) +
    'T' +
    p(n.getUTCHours()) +
    p(n.getUTCMinutes()) +
    p(n.getUTCSeconds()) +
    'Z'
  );
}

export function buildICS(trip: Trip, users: DB['users']): string {
  const L = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Delim Schet//Trip Split//RU', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH'];
  const stamp = icsStamp();
  const ps = tripParticipants(trip, users, null)
    .map((p) => p.name)
    .join(', ');
  if (trip.start) {
    const end = trip.end && trip.end !== trip.start ? trip.end : trip.start;
    L.push(
      'BEGIN:VEVENT',
      'UID:trip-' + trip.id + '@tripsplit',
      'DTSTAMP:' + stamp,
      'SUMMARY:' + icsEsc('🧳 ' + trip.name),
      'DTSTART;VALUE=DATE:' + icsDateOnly(trip.start),
      'DTEND;VALUE=DATE:' + icsAddDay(end),
      'DESCRIPTION:' + icsEsc('Поездка · участники: ' + ps + '\nВалюта: ' + trip.cur),
      'END:VEVENT',
    );
  }
  (trip.events || []).forEach((ev) => {
    const cr = users[ev.createdBy];
    L.push('BEGIN:VEVENT', 'UID:ev-' + ev.id + '@tripsplit', 'DTSTAMP:' + stamp, 'SUMMARY:' + icsEsc(ev.title));
    if (ev.time)
      L.push(
        'DTSTART:' + icsDateTime(ev.date, ev.time),
        'DTEND:' + icsDateTime(ev.date, ev.endTime && ev.endTime > ev.time ? ev.endTime : icsAddHour(ev.time)),
      );
    else L.push('DTSTART;VALUE=DATE:' + icsDateOnly(ev.date), 'DTEND;VALUE=DATE:' + icsAddDay(ev.date));
    L.push('DESCRIPTION:' + icsEsc(trip.name + (cr ? ' · добавил ' + disp(cr.name) : '')), 'END:VEVENT');
  });
  L.push('END:VCALENDAR');
  return L.join('\r\n');
}

export function exportICS(trip: Trip, users: DB['users']): void {
  const ics = buildICS(trip, users);
  try {
    const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = (trip.name || 'Поездка').replace(/[^\p{L}\p{N} _-]/gu, '').trim() + '.ics';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  } catch {
    window.open('data:text/calendar;charset=utf-8,' + encodeURIComponent(ics));
  }
}
