import { useMemo } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { useMe, useStore } from '../hooks/useStore';
import { disp, fmtDate, plural } from '../lib/format';
import { disambiguate, tripParticipants } from '../lib/participants';
import { TripDates } from './trip/TripDates';
import { Participants } from './trip/Participants';
import { NewExpense } from './trip/NewExpense';
import { ExpenseLog } from './trip/ExpenseLog';
import { Balances } from './trip/Balances';
import { Settlements } from './trip/Settlements';
import { Itinerary } from './trip/Itinerary';

export function TripDetailPage() {
  const { id } = useParams();
  const { db, sessionUserId, dispatch } = useStore();
  const me = useMe()!;
  const trip = db.trips.find((t) => t.id === id);

  // Производные данные считаем мемоизированно и раздаём в дочерние блоки.
  const ps = useMemo(
    () => (trip ? tripParticipants(trip, db.users, sessionUserId) : []),
    [trip, db.users, sessionUserId],
  );
  const { idName, idSub } = useMemo(() => disambiguate(ps, db.users), [ps, db.users]);

  if (!trip) return <Navigate to="/trips" replace />;

  const isOwner = trip.ownerId === sessionUserId;
  const ownerName = disp((db.users[trip.ownerId] || { name: '' }).name) || '—';
  const memberCount = trip.members.length;

  return (
    <div className="view" style={{ maxWidth: 1080 }}>
      <div className="card">
        {/* Шапка поездки */}
        <div className="header-band trip-band">
          <div className="deco" style={{ width: 230, height: 230 }} />
          <div style={{ position: 'relative' }}>
            <Link to="/trips" className="back-chip">
              ← К поездкам
            </Link>

            <div className="trip-eyebrow eyebrow">
              ПОЕЗДКА · ВЗАИМОРАСЧЁТ · {trip.cur}
              {trip.start && ' · ' + fmtDate(trip.start, trip.end)}
            </div>

            <input
              className="trip-name-input"
              value={trip.name}
              onChange={(e) => dispatch({ type: 'renameTrip', tripId: trip.id, name: e.target.value })}
              placeholder="Название поездки"
            />

            <div className="sync-pill">
              <span className="sync-dot" />
              Синхронизировано · {plural(memberCount, 'участник', 'участника', 'участников')} · создатель:{' '}
              {ownerName}
              {isOwner && ' (вы)'}
            </div>
          </div>
        </div>

        {/* Тело: 2 колонки */}
        <div className="trip-body">
          <div className="trip-col">
            <TripDates trip={trip} isOwner={isOwner} />
            <Participants trip={trip} ps={ps} idSub={idSub} me={me} />
            <NewExpense trip={trip} ps={ps} idName={idName} />
          </div>

          <div className="trip-col">
            <ExpenseLog trip={trip} idName={idName} isOwner={isOwner} />
            <Balances trip={trip} ps={ps} idName={idName} />
            <Settlements trip={trip} ps={ps} idName={idName} isOwner={isOwner} />
          </div>
        </div>

        {/* Программа поездки */}
        <Itinerary trip={trip} isOwner={isOwner} />
      </div>
    </div>
  );
}
