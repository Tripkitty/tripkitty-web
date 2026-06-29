import { useMemo } from 'react';
import { useStore } from '../../hooks/useStore';
import { fmt } from '../../lib/format';
import { computeSettlements } from '../../lib/settlements';
import type { Participant, Trip } from '../../types';

type Props = {
  trip: Trip;
  ps: Participant[];
  idName: Record<string, string>;
  isOwner: boolean;
};

export function Settlements({ trip, ps, idName, isOwner }: Props) {
  const { dispatch } = useStore();
  const { tx } = useMemo(() => computeSettlements(ps, trip.expenses), [ps, trip.expenses]);

  const hasExpenses = trip.expenses.length > 0;

  const clear = () => {
    if (!confirm('Очистить все расходы и гостей этой поездки?')) return;
    dispatch({ type: 'clearTrip', tripId: trip.id });
  };

  return (
    <>
      <section className="settle-block">
        <label className="field-label">КАК РАССЧИТАТЬСЯ</label>

        {tx.length > 0 ? (
          <div className="settle-list">
            {tx.map((t, i) => (
              <div key={i} className="settle-row">
                <span className="settle-names">
                  {idName[t.from]} <span className="settle-arrow">→</span> {idName[t.to]}
                </span>
                <span className="mono" style={{ fontWeight: 700, color: 'var(--hdr-tx)' }}>
                  {fmt(t.amount, trip.cur)}
                </span>
              </div>
            ))}
          </div>
        ) : hasExpenses ? (
          <div className="settle-note">Все в расчёте — никто никому не должен ✓</div>
        ) : (
          <div className="settle-note">Нет расходов — нечего рассчитывать</div>
        )}
      </section>

      {isOwner && (
        <button type="button" className="link danger" style={{ alignSelf: 'flex-start' }} onClick={clear}>
          Очистить расходы (только владелец)
        </button>
      )}
    </>
  );
}
