import { useState, type KeyboardEvent, type MouseEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMe, useStore } from '../hooks/useStore';
import { useToast } from '../hooks/useToast';
import { ApiError } from '../api/http';
import { fmt, fmtDate, initial, plural } from '../lib/format';
import { userColor } from '../lib/avatar';
import { tripParticipants } from '../lib/participants';
import { HeaderBand } from '../components/HeaderBand';
import type { Trip } from '../types';

const CURRENCIES = [
  { glyph: '₽', label: '₽ рубль' },
  { glyph: '$', label: '$ доллар' },
  { glyph: '€', label: '€ евро' },
  { glyph: '₸', label: '₸ тенге' },
  { glyph: '₴', label: '₴ гривна' },
  { glyph: 'Br', label: 'Br белорусский рубль' },
];

export function TripsListPage() {
  const { db, sessionUserId, dispatch } = useStore();
  const me = useMe()!;
  const navigate = useNavigate();
  const toast = useToast();

  const [name, setName] = useState('');
  const [cur, setCur] = useState('₽');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [busy, setBusy] = useState(false);
  const [nameBad, setNameBad] = useState(false);

  const createTrip = async () => {
    const n = name.trim();
    if (!n) {
      setNameBad(true);
      return toast.error('Назови поездку');
    }
    setBusy(true);
    try {
      // Передаём заглушку-объект; dispatch в StoreContext вызовет API и получит настоящий id.
      await dispatch({
        type: 'createTrip',
        trip: {
          id: '',
          name: n,
          cur,
          ownerId: me.id,
          start,
          end,
          status: 'active',
          isArchived: false,
          members: [me.id],
          guests: [],
          expenses: [],
          events: [],
        },
      });
      setName('');
      setStart('');
      setEnd('');
      navigate('/trips');
    } catch {
      toast.error('Не удалось создать поездку. Попробуй ещё раз.');
    } finally {
      setBusy(false);
    }
  };

  const onNameKey = (e: KeyboardEvent) => { if (e.key === 'Enter') createTrip(); };

  const [showArchived, setShowArchived] = useState(false);
  const myTrips = db.trips.filter((t) => t.members.includes(sessionUserId!) && t.isArchived === showArchived);
  const archivedCount = db.trips.filter((t) => t.members.includes(sessionUserId!) && t.isArchived).length;

  return (
    <div className="view" style={{ maxWidth: 1080 }}>
      <div className="card">
        <HeaderBand eyebrow="НОВАЯ ПОЕЗДКА" title="Куда едем?" />
        <div className="create-body">
          <input
            className={'input' + (nameBad ? ' invalid' : '')}
            placeholder="Напр. Поездка в Казань"
            value={name}
            onChange={(e) => { setName(e.target.value); setNameBad(false); }}
            onKeyDown={onNameKey}
          />
          <div className="row">
            <div className="field-group" style={{ flex: 1, minWidth: 160 }}>
              <label className="field-label">Начало</label>
              <input className="input" type="date" value={start} onChange={(e) => setStart(e.target.value)} />
            </div>
            <div className="field-group" style={{ flex: 1, minWidth: 160 }}>
              <label className="field-label" style={{ color: 'var(--muted)' }}>Конец</label>
              <input className="input" type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
            </div>
          </div>
          <div className="row" style={{ alignItems: 'flex-end' }}>
            <div className="field-group" style={{ flex: 1, minWidth: 140 }}>
              <label className="field-label">Валюта</label>
              <select className="input" value={cur} onChange={(e) => setCur(e.target.value)}>
                {CURRENCIES.map((c) => (
                  <option key={c.glyph} value={c.glyph}>{c.label}</option>
                ))}
              </select>
            </div>
            <button type="button" className="btn" style={{ flex: 1, minWidth: 160 }} onClick={createTrip} disabled={busy}>
              {busy ? 'Создаём…' : 'Создать поездку'}
            </button>
          </div>
        </div>
      </div>

      <div className="eyebrow" style={{ alignSelf: 'flex-start', marginTop: 10, marginBottom: 10 }}>
        МОИ ПОЕЗДКИ
      </div>

      <div className="trip-tabs" style={{ width: '100%', marginBottom: 16 }}>
        <button
          type="button"
          className={'trip-tab-btn' + (!showArchived ? ' active' : '')}
          onClick={() => setShowArchived(false)}
        >
          Активные
        </button>
        <button
          type="button"
          className={'trip-tab-btn' + (showArchived ? ' active' : '')}
          onClick={() => setShowArchived(true)}
        >
          Архив{archivedCount > 0 ? ` (${archivedCount})` : ''}
        </button>
      </div>

      {myTrips.length === 0 ? (
        <div className="empty" style={{ width: '100%' }}>
          {showArchived ? 'В архиве пока пусто' : 'Пока нет поездок. Создай первую выше ↑'}
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

function ArchiveIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="4" rx="1" />
      <path d="M5 8v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8" />
      <path d="M10 13h4" />
    </svg>
  );
}

function TripCard({ trip }: { trip: Trip }) {
  const { db, sessionUserId, dispatch } = useStore();
  const navigate = useNavigate();
  const toast = useToast();

  const total = trip.expenses.reduce((a, e) => a + e.amount, 0);
  const ps = tripParticipants(trip, db.users, sessionUserId);
  const isOwner = trip.ownerId === sessionUserId;

  const del = async (e: MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Удалить поездку для всех участников?')) return;
    try {
      await dispatch({ type: 'deleteTrip', tripId: trip.id });
    } catch (err) {
      if (err instanceof ApiError && err.code === 'TRIP_HAS_EXPENSES') {
        toast.error('В поездке есть расходы — сначала удалите их или очистите поездку');
      } else {
        toast.error('Не удалось удалить поездку');
      }
    }
  };

  const toggleArchive = async (e: MouseEvent) => {
    e.stopPropagation();
    try {
      await dispatch(trip.isArchived ? { type: 'unarchiveTrip', tripId: trip.id } : { type: 'archiveTrip', tripId: trip.id });
      toast.success(trip.isArchived ? 'Поездка возвращена из архива' : 'Поездка отправлена в архив');
    } catch {
      toast.error('Не удалось изменить статус архива');
    }
  };

  return (
    <div className="trip-card" onClick={() => navigate('/trips/' + trip.id)}>
      <div className="trip-card-head">
        <h3 className="trip-card-title">{trip.name || 'Без названия'}</h3>
        <div style={{ display: 'flex', gap: 4 }}>
          <button
            type="button"
            className="remove-btn"
            title={trip.isArchived ? 'Вернуть из архива' : 'Отправить в архив'}
            onClick={toggleArchive}
          >
            <ArchiveIcon />
          </button>
          {isOwner && (
            <button type="button" className="remove-btn" title="Удалить поездку" onClick={del}>
              ✕
            </button>
          )}
        </div>
      </div>

      <div className="avatar-stack">
        {ps.slice(0, 4).map((p) => (
          <span
            key={p.id}
            className="avatar"
            style={{ width: 26, height: 26, fontSize: 12, background: userColor(p.id), marginLeft: -6, border: '2px solid var(--card)' }}
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
