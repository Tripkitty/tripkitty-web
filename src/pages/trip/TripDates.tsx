import { useStore } from '../../hooks/useStore';
import { fmtDate } from '../../lib/format';
import type { Trip } from '../../types';

// Блок «Даты поездки». Владелец редактирует live; остальные видят read-only.
export function TripDates({ trip, isOwner }: { trip: Trip; isOwner: boolean }) {
  const { dispatch } = useStore();

  return (
    <section className="trip-block">
      <label className="field-label">ДАТЫ ПОЕЗДКИ</label>

      {isOwner ? (
        <div className="row">
          <div className="field-group" style={{ flex: 1, minWidth: 160 }}>
            <label className="field-label" style={{ fontSize: 11 }}>
              Начало
            </label>
            <input
              className="input"
              type="date"
              value={trip.start}
              onChange={(e) => dispatch({ type: 'setTripStart', tripId: trip.id, start: e.target.value })}
            />
          </div>
          <div className="field-group" style={{ flex: 1, minWidth: 160 }}>
            <label className="field-label" style={{ fontSize: 11, color: 'var(--muted)' }}>
              Конец
            </label>
            <input
              className="input"
              type="date"
              value={trip.end}
              onChange={(e) => dispatch({ type: 'setTripEnd', tripId: trip.id, end: e.target.value })}
            />
          </div>
        </div>
      ) : trip.start ? (
        <div className="readonly-dates">
          <span className="date-chip">📅</span>
          <div>
            <div style={{ fontWeight: 700, color: 'var(--heading)' }}>{fmtDate(trip.start, trip.end)}</div>
            <div className="hint" style={{ marginTop: 2 }}>
              даты задаёт создатель
            </div>
          </div>
        </div>
      ) : (
        <div className="hint">Создатель ещё не указал даты</div>
      )}
    </section>
  );
}
