import { useCallback, useEffect, useMemo, useState } from 'react';
import { trips as tripsApi } from '../api/api';
import type { PaymentDetails, Trip } from '../types';

// Серверный перевод: кто кому сколько + реквизиты получателя (СБП).
export type ServerTx = { from: string; to: string; amount: number; toPayment: PaymentDetails | null };

export type SettlementsData = {
  balances: Record<string, number> | null;
  transactions: ServerTx[] | null;
  reload: () => void;
};

// Тянет /trips/{id}/settlements (сервер сам минимизирует переводы и округляет).
// Рефетч при изменении расходов/участников, а также вручную (reload) — например,
// после смены собственных реквизитов в поездке, влияющих на toPayment.
export function useSettlements(trip: Trip | undefined): SettlementsData {
  const [balances, setBalances] = useState<Record<string, number> | null>(null);
  const [transactions, setTransactions] = useState<ServerTx[] | null>(null);
  const tripId = trip?.id;

  // Сигнатура значений, влияющих на расчёт — чтобы не рефетчить на каждый ре-рендер
  // (например, посимвольное переименование поездки не должно триггерить запрос).
  const sig = useMemo(
    () =>
      trip
        ? JSON.stringify({
            e: trip.expenses.map((e) => [e.id, e.amount, e.splitType, e.payer, e.share]),
            m: trip.members,
            g: trip.guests.map((x) => x.id),
          })
        : '',
    [trip],
  );

  const reload = useCallback(() => {
    if (!tripId) return;
    tripsApi
      .getSettlements(tripId)
      .then((r) => {
        setBalances(r.balances);
        setTransactions(
          r.transactions.map((t) => ({
            from: t.from,
            to: t.to,
            amount: t.amount,
            toPayment: t.toPayment ?? null,
          })),
        );
      })
      .catch(() => {
        // На ошибке оставляем null — компоненты откатятся на локальный расчёт.
        setBalances(null);
        setTransactions(null);
      });
  }, [tripId]);

  useEffect(() => {
    reload();
  }, [reload, sig]);

  return { balances, transactions, reload };
}
