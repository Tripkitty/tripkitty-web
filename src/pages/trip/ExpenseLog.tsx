import { useState } from 'react';
import { useStore } from '../../hooks/useStore';
import { disp, fmt } from '../../lib/format';
import { expenseShareAmounts } from '../../lib/settlements';
import { ExpenseModal } from '../../components/ExpenseModal';
import type { Expense, Participant, Trip } from '../../types';

type Props = {
  trip: Trip;
  ps: Participant[];
  idName: Record<string, string>;
  isOwner: boolean;
};

// Подпись разбивки: поровну — «на 3: Аня, Боб…», по частям/суммам — доля каждого.
function buildShareLabel(e: Expense, idName: Record<string, string>, cur: string): string {
  if (e.splitType === 0) {
    return 'на ' + e.share.length + ': ' + e.share.map((s) => idName[s.participantId]).filter(Boolean).join(', ');
  }
  const parts = expenseShareAmounts(e);
  const list = e.share
    .filter((s) => idName[s.participantId])
    .map((s) => idName[s.participantId] + ' — ' + fmt(parts[s.participantId] ?? 0, cur))
    .join(', ');
  return (e.splitType === 1 ? 'по частям: ' : 'по суммам: ') + list;
}

export function ExpenseLog({ trip, ps, idName, isOwner }: Props) {
  const { db, sessionUserId, dispatch } = useStore();
  const total = trip.expenses.reduce((a, e) => a + e.amount, 0);
  const [editing, setEditing] = useState<Expense | null>(null);

  return (
    <section className="trip-block">
      <div className="block-head">
        <label className="field-label">ЖУРНАЛ РАСХОДОВ</label>
        {trip.expenses.length > 0 && (
          <span className="mono" style={{ fontWeight: 700, color: 'var(--heading)' }}>
            {fmt(total, trip.cur)}
          </span>
        )}
      </div>

      {trip.expenses.length === 0 ? (
        <div className="empty">Пока нет расходов. Добавь первый слева ←</div>
      ) : (
        <div className="log-list">
          {trip.expenses.map((e) => {
            const cr = db.users[e.createdBy];
            const mine = e.createdBy === sessionUserId;
            const canDelete = mine || isOwner;
            const shareLabel = buildShareLabel(e, idName, trip.cur);
            return (
              <div key={e.id} className="log-row">
                <div className="log-main">
                  <div className="log-title">{e.title}</div>
                  <div className="hint">{shareLabel}</div>
                </div>
                <div className="log-side">
                  <div className="mono" style={{ fontSize: 16, color: 'var(--heading)' }}>
                    {fmt(e.amount, trip.cur)}
                  </div>
                  <div className="hint">платил {idName[e.payer] || '—'}</div>
                </div>
                {canDelete ? (
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      type="button"
                      className="remove-btn"
                      title="Редактировать расход"
                      onClick={() => setEditing(e)}
                    >
                      ✎
                    </button>
                    <button
                      type="button"
                      className="remove-btn"
                      title={mine ? 'Удалить свой расход' : 'Удалить как владелец поездки'}
                      onClick={() => dispatch({ type: 'removeExpense', tripId: trip.id, expenseId: e.id })}
                    >
                      ✕
                    </button>
                  </div>
                ) : (
                  <span className="lock" title={'добавил ' + (cr ? disp(cr.name) : '—')}>
                    🔒
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}

      {editing && (
        <ExpenseModal trip={trip} ps={ps} idName={idName} expense={editing} onClose={() => setEditing(null)} />
      )}
    </section>
  );
}
