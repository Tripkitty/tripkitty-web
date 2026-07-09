import { useMemo, useState, type KeyboardEvent } from 'react';
import { useStore } from '../../hooks/useStore';
import { useToast } from '../../hooks/useToast';
import { disp, fmtDayLong } from '../../lib/format';
import { trips as tripsApi } from '../../api/api';
import type { Trip, TripEvent } from '../../types';

export function Itinerary({ trip, isOwner }: { trip: Trip; isOwner: boolean }) {
  const { db, sessionUserId, dispatch } = useStore();
  const toast = useToast();

  const [title, setTitle] = useState('');
  const [date, setDate] = useState(trip.start || '');
  const [time, setTime] = useState('');
  const [endTime, setEndTime] = useState('');
  // Невалидные поля (подсветка снимается при вводе) и блокировка кнопок календаря на время запроса.
  const [bad, setBad] = useState<Record<string, boolean>>({});
  const [calBusy, setCalBusy] = useState(false);
  const clearBad = (k: string) => setBad((b) => (b[k] ? { ...b, [k]: false } : b));

  const add = () => {
    const t = title.trim();
    if (!date) {
      setBad({ date: true });
      return toast.error('Укажи дату события');
    }
    if (!t) {
      setBad({ title: true });
      return toast.error('Назови событие');
    }
    let end = endTime;
    if (end && !time) end = ''; // конец игнорируется без начала
    // id придёт от сервера через dispatch; placeholder для TypeScript.
    const ev: TripEvent = { id: '', title: t, date, time, endTime: end, createdBy: sessionUserId! };
    dispatch({ type: 'addEvent', tripId: trip.id, event: ev });
    setTitle('');
    setTime('');
    setEndTime('');
  };
  const onTitleKey = (e: KeyboardEvent) => {
    if (e.key === 'Enter') add();
  };

  // Группировка событий по дням (сортировка по дате, затем по времени).
  const program = useMemo(() => {
    const evs = (trip.events || [])
      .slice()
      .sort((a, b) => (a.date === b.date ? (a.time || '').localeCompare(b.time || '') : a.date.localeCompare(b.date)));
    const dayMap: Record<string, { date: string; label: string; items: TripEvent[] }> = {};
    const days: { date: string; label: string; items: TripEvent[] }[] = [];
    evs.forEach((ev) => {
      if (!dayMap[ev.date]) {
        dayMap[ev.date] = { date: ev.date, label: fmtDayLong(ev.date), items: [] };
        days.push(dayMap[ev.date]);
      }
      dayMap[ev.date].items.push(ev);
    });
    return days;
  }, [trip.events]);

  const hasEvents = (trip.events || []).length > 0;
  const canExport = !!trip.start || hasEvents;

  const timeLabel = (ev: TripEvent) =>
    !ev.time ? 'весь день' : ev.endTime ? ev.time + ' – ' + ev.endTime : ev.time;

  return (
    <section className="trip-block itinerary">
      <div className="block-head">
        <div>
          <h2 className="itinerary-title">Программа поездки</h2>
          <div className="hint">План событий — общий для всех участников</div>
        </div>
        {canExport && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <button
              type="button"
              className="btn sm"
              style={{ background: 'var(--accent)', color: '#fff' }}
              disabled={calBusy}
              onClick={async () => {
                setCalBusy(true);
                try {
                  const { url } = await tripsApi.getCalendarUrl(trip.id);
                  // location.href вместо window.open: Safari блокирует window.open после await,
                  // а переход по webcal:// не выгружает страницу.
                  window.location.href = url;
                } catch {
                  toast.error('Не удалось получить ссылку на календарь');
                } finally {
                  setCalBusy(false);
                }
              }}
            >
              🔔 Подписаться на календарь
            </button>
            <button
              type="button"
              className="btn sm"
              disabled={calBusy}
              onClick={async () => {
                setCalBusy(true);
                try {
                  const blob = await tripsApi.getCalendarIcs(trip.id);
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = trip.name + '.ics';
                  a.click();
                  URL.revokeObjectURL(url);
                } catch {
                  toast.error('Не удалось получить файл календаря');
                } finally {
                  setCalBusy(false);
                }
              }}
            >
              📅 Скачать .ics
            </button>
          </div>
        )}
      </div>

      {/* Добавление события */}
      <div className="add-box">
        <div className="row">
          <input
            className={'input' + (bad.title ? ' invalid' : '')}
            style={{ flex: 2, minWidth: 160 }}
            placeholder="Музей, ужин, выезд…"
            value={title}
            onChange={(e) => { setTitle(e.target.value); clearBad('title'); }}
            onKeyDown={onTitleKey}
          />
          <input
            className={'input' + (bad.date ? ' invalid' : '')}
            style={{ flex: 1, minWidth: 130 }}
            type="date"
            value={date}
            onChange={(e) => { setDate(e.target.value); clearBad('date'); }}
          />
          <div className="time-range">
            <input className="input mono" type="time" lang="ru" value={time} onChange={(e) => setTime(e.target.value)} />
            <span style={{ color: 'var(--muted)' }}>–</span>
            <input
              className="input mono"
              type="time"
              lang="ru"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
            />
          </div>
          <button type="button" className="btn sm" onClick={add}>
            Добавить
          </button>
        </div>
      </div>

      {/* Список событий */}
      {!hasEvents ? (
        <div className="empty">
          Событий пока нет. Добавь план поездки выше — потом одной кнопкой выгрузишь всё в календарь (.ics).
        </div>
      ) : (
        <div className="program">
          {program.map((day) => (
            <div key={day.date} className="day-group">
              <div className="day-head">
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent)' }} />
                {day.label}
              </div>
              <div className="day-items">
                {day.items.map((ev) => {
                  const cr = db.users[ev.createdBy];
                  const canDelete = ev.createdBy === sessionUserId || isOwner;
                  return (
                    <div key={ev.id} className="itinerary-item">
                      <span className="mono item-time">{timeLabel(ev)}</span>
                      <div className="item-main">
                        <span className="item-title">{ev.title}</span>
                        {cr && <span className="hint">добавил {disp(cr.name)}</span>}
                      </div>
                      {canDelete && (
                        <button
                          type="button"
                          className="remove-btn"
                          title="Удалить событие"
                          onClick={() => dispatch({ type: 'removeEvent', tripId: trip.id, eventId: ev.id })}
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
