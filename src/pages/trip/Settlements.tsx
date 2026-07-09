import { useMemo, useState } from 'react';
import { useStore } from '../../hooks/useStore';
import { useToast } from '../../hooks/useToast';
import { useBanks } from '../../hooks/useBanks';
import { trips as tripsApi, type ApiSettlements } from '../../api/api';
import { ApiError } from '../../api/http';
import { fmt, formatPhone } from '../../lib/format';
import { computeSettlements } from '../../lib/settlements';
import type { ServerTx } from '../../hooks/useSettlements';
import type { Participant, Trip, TripStatus } from '../../types';

type Props = {
  trip: Trip;
  ps: Participant[];
  idName: Record<string, string>;
  isOwner: boolean;
  status: TripStatus;
  // Серверные переводы с реквизитами получателя (toPayment); при недоступности — локальный расчёт.
  transactions?: ServerTx[] | null;
  // Применяет ответ settlement-эндпоинтов к состоянию useSettlements без рефетча.
  apply: (s: ApiSettlements) => void;
};

// Человекочитаемые сообщения для кодов settlement-ошибок.
function settlementError(e: unknown, fallback: string): string {
  if (e instanceof ApiError) {
    switch (e.code) {
      case 'ALREADY_FINALIZED': return 'Подсчёт уже завершён';
      case 'NOT_FINALIZED': return 'Подсчёт ещё не завершён — обновите страницу';
      case 'TRANSACTION_NOT_FOUND': return 'Перевод не найден — список обновился, попробуйте ещё раз';
      case 'FORBIDDEN': return 'Это не ваш перевод';
    }
  }
  return fallback;
}

export function Settlements({ trip, ps, idName, isOwner, status, transactions, apply }: Props) {
  const { sessionUserId, dispatch } = useStore();
  const toast = useToast();
  const { bankName } = useBanks();
  const [busy, setBusy] = useState(false);

  // Фолбэк на локальный расчёт (без реквизитов), если сервер не отдал переводы.
  // В этом режиме реквизиты получателя неизвестны, поэтому подпись про них не показываем.
  const serverMode = transactions != null;
  const localTx = useMemo(() => computeSettlements(ps, trip.expenses).tx, [ps, trip.expenses]);
  const tx: ServerTx[] = transactions
    ?? localTx.map((t) => ({ ...t, toPayment: null, id: null, isPaid: null, paidAt: null }));

  const hasExpenses = trip.expenses.length > 0;
  const finalized = status !== 'active';

  // Отметить оплату может любой из концов перевода; за гостя — любой участник поездки.
  // Сервер проверяет права сам — это только чтобы не показывать заведомо недоступную кнопку.
  const canTogglePaid = (t: ServerTx): boolean =>
    t.from === sessionUserId || t.to === sessionUserId ||
    t.from.startsWith('g_') || t.to.startsWith('g_');

  const finalize = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const { settlements } = await tripsApi.finalizeSettlement(trip.id);
      apply(settlements);
      toast.success('Подсчёт завершён — переводы зафиксированы');
    } catch (e) {
      toast.error(settlementError(e, 'Не удалось завершить подсчёт'));
    } finally {
      setBusy(false);
    }
  };

  const togglePaid = async (t: ServerTx) => {
    if (busy || !t.id) return;
    setBusy(true);
    try {
      const { settlements } = await tripsApi.setTransactionPaid(trip.id, t.id, !t.isPaid);
      apply(settlements);
    } catch (e) {
      toast.error(settlementError(e, 'Не удалось отметить оплату'));
    } finally {
      setBusy(false);
    }
  };

  const reopen = async () => {
    if (busy) return;
    if (!confirm('Переоткрыть подсчёт? Неоплаченные переводы будут удалены, а оплаченные превратятся в расходы-переводы.')) return;
    setBusy(true);
    try {
      const { settlements } = await tripsApi.reopenSettlement(trip.id);
      apply(settlements);
      // Reopen создаёт на сервере расходы-переводы — подтягиваем их в store.
      await dispatch({ type: 'refetchTrip', tripId: trip.id });
      toast.success('Подсчёт переоткрыт — можно добавлять расходы');
    } catch (e) {
      toast.error(settlementError(e, 'Не удалось переоткрыть подсчёт'));
    } finally {
      setBusy(false);
    }
  };

  const clear = async () => {
    if (!confirm('Очистить все расходы, гостей и зафиксированный подсчёт этой поездки?')) return;
    try {
      await dispatch({ type: 'clearTrip', tripId: trip.id });
    } catch {
      toast.error('Не удалось очистить поездку');
    }
  };

  return (
    <>
      <section className="settle-block">
        <div className="settle-head">
          <label className="field-label">КАК РАССЧИТАТЬСЯ</label>
          {status === 'settling' && <span className="settle-status">подсчёт завершён</span>}
          {status === 'settled' && <span className="settle-status ok">рассчитано ✓</span>}
        </div>

        {status === 'settled' && (
          <div className="settle-note">Все переводы выполнены — поездка рассчитана ✓</div>
        )}

        {tx.length > 0 ? (
          <div className="settle-list">
            {tx.map((t, i) => (
              <div key={t.id ?? i} className={'settle-row' + (t.isPaid ? ' paid' : '')}>
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
                {finalized && t.id && (
                  canTogglePaid(t) ? (
                    <button
                      type="button"
                      className={'settle-paid-btn' + (t.isPaid ? ' on' : '')}
                      disabled={busy}
                      onClick={() => togglePaid(t)}
                    >
                      {t.isPaid ? '✓ Оплачено' : 'Отметить оплаченным'}
                    </button>
                  ) : (
                    <span className={'settle-paid-mark' + (t.isPaid ? ' on' : '')}>
                      {t.isPaid ? '✓ оплачено' : 'ждёт оплаты'}
                    </span>
                  )
                )}
              </div>
            ))}
          </div>
        ) : hasExpenses && status === 'active' ? (
          <div className="settle-note">Все в расчёте — никто никому не должен ✓</div>
        ) : status === 'active' ? (
          <div className="settle-note">Нет расходов — нечего рассчитывать</div>
        ) : null}

        {status === 'active' && isOwner && serverMode && tx.length > 0 && (
          <>
            <div className="settle-note" style={{ opacity: 0.7 }}>
              Это предварительный расчёт — он меняется с каждым расходом. Заверши подсчёт,
              чтобы зафиксировать переводы и отмечать оплату.
            </div>
            <button type="button" className="btn" disabled={busy} onClick={finalize}>
              Завершить подсчёт
            </button>
          </>
        )}

        {finalized && isOwner && (
          <button type="button" className="settle-reopen" disabled={busy} onClick={reopen}>
            Переоткрыть подсчёт (забыли расход?)
          </button>
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
