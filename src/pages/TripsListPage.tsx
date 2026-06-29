import { useState, type KeyboardEvent, type MouseEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMe, useStore } from '../hooks/useStore';
import { fmt, fmtDate, initial, plural } from '../lib/format';
import { userColor } from '../lib/avatar';
import { tripParticipants } from '../lib/participants';
import { uid } from '../lib/id';
import { HeaderBand } from '../components/HeaderBand';
import type { Trip } from '../types';

const CURRENCIES = [
  { glyph: '₽', label: '₽ рубль' },
  { glyph: '$', label: '$ доллар' },
  { glyph: '€', label: '€ евро' },
  { glyph: '₸', label: '₸ тенге' },
  { glyph: '₴', label: '₴ гривна' },
];

export function TripsListPage() {
  const { db, sessionUserId, dispatch } = useStore();
  const me = useMe()!;
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [cur, setCur] = useState('₽');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');

  const createTrip = () => {
    const id = uid();
    const trip: Trip = {
      id,
      name: name.trim() || 'Без названия',
      cur,
      ownerId: me.id,
      start,
      end,
      members: [me.id],
      guests: [],
      expenses: [],
      events: [],
    };
    dispatch({ type: 'createTrip', trip });
    setName('');
    setStart('');
    setEnd('');
    navigate('/trips/' + id);
  };

  const onNameKey = (e: KeyboardEvent) => {
    if (e.key === 'Enter') createTrip();
  };

  const myTrips = db.trips.filter((t) => t.members.includes(sessionUserId!));

  return (
    <div className="view" style={{ maxWidth: 1080 }}>
      {/* Карточка создания поездки */}
      <div className="card">
        <HeaderBand eyebrow="НОВАЯ ПОЕЗДКА" title="Куда едем?" />
        <div className="create-body">
          <input
            className="input"
            placeholder="Напр. Поездка в Казань"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={onNameKey}
          />
          <div className="row">
            <div className="field-group" style={{ flex: 1, minWidth: 160 }}>
              <label className="field-label">Начало</label>
              <input className="input" type="date" value={start} onChange={(e) => setStart(e.target.value)} />
            </div>
            <div className="field-group" style={{ flex: 1, minWidth: 160 }}>
              <label className="field-label" style={{ color: 'var(--muted)' }}>
                Конец
              </label>
              <input className="input" type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
            </div>
          </div>
          <div className="row" style={{ alignItems: 'flex-end' }}>
            <div className="field-group" style={{ flex: 1, minWidth: 140 }}>
              <label className="field-label">Валюта</label>
              <select className="input" value={cur} onChange={(e) => setCur(e.target.value)}>
                {CURRENCIES.map((c) => (
                  <option key={c.glyph} value={c.glyph}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
            <button type="button" className="btn" style={{ flex: 1, minWidth: 160 }} onClick={createTrip}>
              Создать поездку
            </button>
          </div>
        </div>
      </div>

      {/* Список поездок */}
      <div className="eyebrow" style={{ alignSelf: 'flex-start', marginTop: 10, marginBottom: 10 }}>
        МОИ ПОЕЗДКИ
      </div>

      {myTrips.length === 0 ? (
        <div className="empty" style={{ width: '100%' }}>
          Пока нет поездок. Создай первую выше ↑
        </div>
      ) : (
        <div className="trips-grid">
          {myTrips.map((t) => (
            <TripCard key={t.id} trip={t} />
          ))}
        </div>
      )}
    </div>
  );
}

function TripCard({ trip }: { trip: Trip }) {
  const { db, sessionUserId, dispatch } = useStore();
  const navigate = useNavigate();

  const total = trip.expenses.reduce((a, e) => a + e.amount, 0);
  const ps = tripParticipants(trip, db.users, sessionUserId);
  const isOwner = trip.ownerId === sessionUserId;

  const del = (e: MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Удалить поездку для всех участников?')) return;
    dispatch({ type: 'deleteTrip', tripId: trip.id });
  };

  return (
    <div className="trip-card" onClick={() => navigate('/trips/' + trip.id)}>
      <div className="trip-card-head">
        <h3 className="trip-card-title">{trip.name || 'Без названия'}</h3>
        {isOwner && (
          <button type="button" className="remove-btn" title="Удалить поездку" onClick={del}>
            ✕
          </button>
        )}
      </div>

      <div className="avatar-stack">
        {ps.slice(0, 4).map((p) => (
          <span
            key={p.id}
            className="avatar"
            style={{
              width: 26,
              height: 26,
              fontSize: 12,
              background: userColor(p.id),
              marginLeft: -6,
              border: '2px solid var(--card)',
            }}
          >
            {initial(p.name)}
          </span>
        ))}
        <span style={{ marginLeft: 10, fontSize: 13.5, color: 'var(--muted)', fontWeight: 600 }}>
          {plural(ps.length, 'участник', 'участника', 'участников')}
        </span>
      </div>

      {trip.start && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13.5, color: 'var(--muted)' }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--accent)' }} />
          {fmtDate(trip.start, trip.end)}
        </div>
      )}

      <div className="trip-card-foot">
        <span className="mono" style={{ fontSize: 22, fontWeight: 700, color: 'var(--heading)' }}>
          {fmt(total, trip.cur)}
        </span>
        <span className="link accent">Открыть →</span>
      </div>
    </div>
  );
}
