import { useState } from 'react';
import { useStore } from '../../hooks/useStore';
import { useToast } from '../../hooks/useToast';
import { ApiError } from '../../api/http';
import { disp, fmt } from '../../lib/format';
import { expenseShareAmounts } from '../../lib/settlements';
import { ExpenseModal } from '../../components/ExpenseModal';
import type { Expense, Participant, Trip, TripStatus } from '../../types';

type Props = {
  trip: Trip;
  ps: Participant[];
  idName: Record<string, string>;
  isOwner: boolean;
  status: TripStatus;
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

export function ExpenseLog({ trip, ps, idName, isOwner, status }: Props) {
  const { db, sessionUserId, dispatch } = useStore();
  const toast = useToast();
  const total = trip.expenses.reduce((a, e) => a + e.amount, 0);
  const [editing, setEditing] = useState<Expense | null>(null);

  const remove = async (expenseId: string) => {
    try {
      await dispatch({ type: 'removeExpense', tripId: trip.id, expenseId });
    } catch (e) {
      if (e instanceof ApiError && e.code === 'TRIP_SETTLING') {
        toast.error('Подсчёт завершён — изменения расходов заблокированы');
      } else if (e instanceof ApiError && e.code === 'TRANSFER_READONLY') {
        toast.error('Расход-перевод нельзя удалить');
      } else {
        toast.error('Не удалось удалить расход');
      }
    }
  };

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
            // Расход-перевод (isTransfer) read-only для всех; в settling/settled мутации заблокированы.
            const canEdit = (mine || isOwner) && !e.isTransfer && status === 'active';
            const shareLabel = buildShareLabel(e, idName, trip.cur);
            return (
              <div key={e.id} className={'log-row' + (e.isTransfer ? ' transfer' : '')}>
                <div className="log-main">
                  <div className="log-title">{e.title}</div>
                  <div className="hint">{shareLabel}</div>
                </div>
                <div className="log-side">
                  <div className="mono" style={{ fontSize: 16, color: 'var(--heading)', display: 'flex', alignItems: 'baseline', gap: 6, justifyContent: 'flex-end' }}>
                    {e.grossAmount != null && (
                      <span className="hint mono" style={{ fontSize: 12, textDecoration: 'line-through' }}>
                        {fmt(e.grossAmount, trip.cur)}
                      </span>
                    )}
                    <span>{fmt(e.amount, trip.cur)}</span>
                  </div>
                  <div className="hint">
                    {e.grossAmount != null &&
                      'скидка ' + (e.discountPercent != null ? e.discountPercent + '%' : fmt(e.discountAmount ?? 0, trip.cur)) + ' · '}
                    платил {idName[e.payer] || '—'}
                  </div>
                </div>
                {canEdit ? (
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
                      onClick={() => remove(e.id)}
                    >
                      ✕
                    </button>
                  </div>
                ) : e.isTransfer || status !== 'active' ? null : (
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
