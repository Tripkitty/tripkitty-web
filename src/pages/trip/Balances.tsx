import { useMemo } from 'react';
import { fmt } from '../../lib/format';
import { computeSettlements } from '../../lib/settlements';
import type { Participant, Trip } from '../../types';

type Props = {
  trip: Trip;
  ps: Participant[];
  idName: Record<string, string>;
};

// Баланс по участникам: знак и цвет суммы + текстовая заметка.
export function Balances({ trip, ps, idName }: Props) {
  const { bal } = useMemo(() => computeSettlements(ps, trip.expenses), [ps, trip.expenses]);

  return (
    <section className="trip-block">
      <label className="field-label">БАЛАНС ПО УЧАСТНИКАМ</label>

      {ps.length === 0 ? (
        <div className="hint">Добавь участников, чтобы увидеть баланс</div>
      ) : (
        <div className="balance-list">
          {ps.map((p) => {
            const v = bal[p.id] || 0;
            const pos = v > 0.005;
            const neg = v < -0.005;
            const color = pos ? 'var(--pos)' : neg ? 'var(--neg)' : 'var(--muted)';
            return (
              <div key={p.id} className="balance-row">
                <div>
                  <div style={{ fontWeight: 700, color: 'var(--heading)' }}>{idName[p.id]}</div>
                  <div className="hint">{pos ? 'получит назад' : neg ? 'должен скинуться' : 'всё ровно'}</div>
                </div>
                <span className="mono" style={{ fontSize: 16, fontWeight: 700, whiteSpace: 'nowrap', color }}>
                  {fmt(v, trip.cur)}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
