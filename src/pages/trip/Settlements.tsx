import { useMemo } from 'react';
import { useStore } from '../../hooks/useStore';
import { useBanks } from '../../hooks/useBanks';
import { fmt, formatPhone } from '../../lib/format';
import { computeSettlements } from '../../lib/settlements';
import type { ServerTx } from '../../hooks/useSettlements';
import type { Participant, Trip } from '../../types';

type Props = {
  trip: Trip;
  ps: Participant[];
  idName: Record<string, string>;
  isOwner: boolean;
  // Серверные переводы с реквизитами получателя (toPayment); при недоступности — локальный расчёт.
  transactions?: ServerTx[] | null;
};

export function Settlements({ trip, ps, idName, isOwner, transactions }: Props) {
  const { dispatch } = useStore();
  const { bankName } = useBanks();

  // Фолбэк на локальный расчёт (без реквизитов), если сервер не отдал переводы.
  // В этом режиме реквизиты получателя неизвестны, поэтому подпись про них не показываем.
  const serverMode = transactions != null;
  const localTx = useMemo(() => computeSettlements(ps, trip.expenses).tx, [ps, trip.expenses]);
  const tx: ServerTx[] = transactions ?? localTx.map((t) => ({ ...t, toPayment: null }));

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
                <div className="settle-main">
                  <span className="settle-names">
                    {idName[t.from]} <span className="settle-arrow">→</span> {idName[t.to]}
                  </span>
                  <span className="mono" style={{ fontWeight: 700, color: 'var(--hdr-tx)' }}>
                    {fmt(t.amount, trip.cur)}
                  </span>
                </div>
                {t.toPayment ? (
                  <div className="settle-pay">
                    <span className="settle-pay-phone mono">{formatPhone(t.toPayment.phone)}</span>
                    <span className="settle-pay-banks">
                      {t.toPayment.banks.map(bankName).join(' · ')}
                    </span>
                  </div>
                ) : serverMode ? (
                  <div className="settle-pay settle-pay-none">
                    у получателя нет реквизитов для перевода
                  </div>
                ) : null}
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
