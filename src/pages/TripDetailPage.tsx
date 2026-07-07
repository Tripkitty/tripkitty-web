import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { joinTrip, leaveTrip } from '../api/signalr';
import { useMe, useStore } from '../hooks/useStore';
import { disp, fmtDate, plural } from '../lib/format';
import { disambiguate, tripParticipants } from '../lib/participants';
import { TripDates } from './trip/TripDates';
import { Participants } from './trip/Participants';
import { NewExpense } from './trip/NewExpense';
import { ExpenseLog } from './trip/ExpenseLog';
import { Balances } from './trip/Balances';
import { Settlements } from './trip/Settlements';
import { MyTripPayment } from './trip/MyTripPayment';
import { Itinerary } from './trip/Itinerary';
import { useSettlements } from '../hooks/useSettlements';

type Tab = 'participants' | 'expenses' | 'itinerary';

const TABS: { id: Tab; label: string }[] = [
  { id: 'participants', label: 'Участники' },
  { id: 'expenses', label: 'Расходы' },
  { id: 'itinerary', label: 'Программа поездки' },
];

export function TripDetailPage() {
  const { id } = useParams();
  const { db, sessionUserId, dispatch } = useStore();
  const me = useMe()!;
  const trip = db.trips.find((t) => t.id === id);
  const [activeTab, setActiveTab] = useState<Tab>('participants');

  const ps = useMemo(
    () => (trip ? tripParticipants(trip, db.users, sessionUserId) : []),
    [trip, db.users, sessionUserId],
  );
  const { idDisp, idName, idSub } = useMemo(() => disambiguate(ps, db.users), [ps, db.users]);

  // Взаиморасчёты считает сервер (учитывает реквизиты получателя для toPayment).
  const settlements = useSettlements(trip);

  useEffect(() => {
    if (!id) return;
    joinTrip(id).catch(() => {});
    return () => { leaveTrip(id).catch(() => {}); };
  }, [id]);

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

        {/* Таб-бар */}
        <div className="trip-tabs">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={`trip-tab-btn${activeTab === tab.id ? ' active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Содержимое вкладок */}
        <div className="trip-body">
          {activeTab === 'participants' && (
            <div className="trip-col">
              <TripDates trip={trip} isOwner={isOwner} />
              <Participants trip={trip} ps={ps} idDisp={idDisp} idSub={idSub} me={me} />
            </div>
          )}

          {activeTab === 'expenses' && (
            <div className="trip-col">
              <NewExpense trip={trip} ps={ps} idName={idName} />
              <ExpenseLog trip={trip} idName={idName} isOwner={isOwner} />
              <Balances trip={trip} ps={ps} idName={idName} balances={settlements.balances} />
              <MyTripPayment tripId={trip.id} onChanged={settlements.reload} />
              <Settlements trip={trip} ps={ps} idName={idName} isOwner={isOwner} transactions={settlements.transactions} />
            </div>
          )}

          {activeTab === 'itinerary' && (
            <div className="trip-col">
              <Itinerary trip={trip} isOwner={isOwner} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
