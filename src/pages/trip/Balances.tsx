import { useMemo } from 'react';
import { fmt } from '../../lib/format';
import { computeSettlements } from '../../lib/settlements';
import type { Participant, Trip } from '../../types';

type Props = {
  trip: Trip;
  ps: Participant[];
  idName: Record<string, string>;
  // Серверные балансы (источник правды); при недоступности — локальный расчёт как фолбэк.
  // balances — после слияния общих бюджетов (у подопечных 0), ownBalances — персональные.
  balances?: Record<string, number> | null;
  ownBalances?: Record<string, number> | null;
};

// Цвет суммы по знаку баланса.
function balColor(v: number): string {
  return v > 0.005 ? 'var(--pos)' : v < -0.005 ? 'var(--neg)' : 'var(--muted)';
}

// Баланс по участникам: знак и цвет суммы + текстовая заметка.
// Подопечные общего бюджета (§4.4) рисуются внутри блока спонсора строками
// «из них за …» с персональным балансом, а не как отдельные люди с нулём.
export function Balances({ trip, ps, idName, balances, ownBalances }: Props) {
  const local = useMemo(() => computeSettlements(ps, trip.expenses).bal, [ps, trip.expenses]);
  const bal = balances ?? local;

  const sponsors = trip.sponsors ?? {};
  // Группировка возможна только с серверными данными: локальный фолбэк не сливает
  // бюджеты — в нём показываем плоский список персональных балансов.
  const grouped = balances != null && ownBalances != null;
  const rows = grouped ? ps.filter((p) => !sponsors[p.id]) : ps;
  const dependentsOf = (pid: string) => (grouped ? ps.filter((p) => sponsors[p.id] === pid) : []);

  return (
    <section className="trip-block">
      <label className="field-label">БАЛАНС ПО УЧАСТНИКАМ</label>

      {ps.length === 0 ? (
        <div className="hint">Добавь участников, чтобы увидеть баланс</div>
      ) : (
        <div className="balance-list">
          {rows.map((p) => {
            const v = bal[p.id] || 0;
            const pos = v > 0.005;
            const neg = v < -0.005;
            const deps = dependentsOf(p.id);
            return (
              <div key={p.id} className="balance-item">
                <div className="balance-row">
                  <div>
                    <div style={{ fontWeight: 700, color: 'var(--heading)' }}>{idName[p.id]}</div>
                    <div className="hint">{pos ? 'получит назад' : neg ? 'должен скинуться' : 'всё ровно'}</div>
                  </div>
                  <span className="mono" style={{ fontSize: 16, fontWeight: 700, whiteSpace: 'nowrap', color: balColor(v) }}>
                    {fmt(v, trip.cur)}
                  </span>
                </div>
                {deps.map((d) => {
                  const own = ownBalances?.[d.id] ?? 0;
                  return (
                    <div key={d.id} className="balance-sub-row">
                      <span>из них за {idName[d.id]}</span>
                      <span className="mono" style={{ whiteSpace: 'nowrap', color: balColor(own) }}>
                        {fmt(own, trip.cur)}
                      </span>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
