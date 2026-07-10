import { useCallback, useEffect, useMemo, useState } from 'react';
import { trips as tripsApi, type ApiSettlements } from '../api/api';
import { onHubEvent } from '../api/signalr';
import { mapTripStatus } from '../api/mappers';
import type { PaymentDetails, Trip, TripStatus } from '../types';

// Серверный перевод: кто кому сколько + реквизиты получателя (СБП).
// id/isPaid/paidAt заполнены только после финализации подсчёта (status settling/settled).
export type ServerTx = {
  from: string;
  to: string;
  amount: number;
  toPayment: PaymentDetails | null;
  id: string | null;
  isPaid: boolean | null;
  paidAt: string | null;
};

export type SettlementsData = {
  status: TripStatus | null;
  // Итоговые балансы (после слияния общих бюджетов — у подопечных 0).
  balances: Record<string, number> | null;
  // Персональные балансы до слияния бюджетов (для строк «из них за …» у спонсора).
  ownBalances: Record<string, number> | null;
  transactions: ServerTx[] | null;
  reload: () => void;
  // Применить ответ settlement-эндпоинта (finalize/paid/reopen) без рефетча.
  apply: (s: ApiSettlements) => void;
};

// Тянет /trips/{id}/settlements (сервер сам минимизирует переводы и округляет).
// Рефетч при изменении расходов/участников, а также вручную (reload) — например,
// после смены собственных реквизитов в поездке, влияющих на toPayment.
export function useSettlements(trip: Trip | undefined): SettlementsData {
  const [status, setStatus] = useState<TripStatus | null>(null);
  const [balances, setBalances] = useState<Record<string, number> | null>(null);
  const [ownBalances, setOwnBalances] = useState<Record<string, number> | null>(null);
  const [transactions, setTransactions] = useState<ServerTx[] | null>(null);
  const tripId = trip?.id;

  const apply = useCallback((s: ApiSettlements) => {
    setStatus(mapTripStatus(s.status));
    setBalances(s.balances);
    setOwnBalances(s.ownBalances ?? null);
    setTransactions(
      s.transactions.map((t) => ({
        from: t.from,
        to: t.to,
        amount: t.amount,
        toPayment: t.toPayment ?? null,
        id: t.id ?? null,
        isPaid: t.isPaid ?? null,
        paidAt: t.paidAt ?? null,
      })),
    );
  }, []);

  // Сигнатура значений, влияющих на расчёт — чтобы не рефетчить на каждый ре-рендер
  // (например, посимвольное переименование поездки не должно триггерить запрос).
  const sig = useMemo(
    () =>
      trip
        ? JSON.stringify({
            e: trip.expenses.map((e) => [e.id, e.amount, e.splitType, e.payer, e.share]),
            m: trip.members,
            g: trip.guests.map((x) => x.id),
            // Назначение/снятие общего бюджета меняет balances/transactions.
            s: trip.sponsors ?? {},
          })
        : '',
    [trip],
  );

  const reload = useCallback(() => {
    if (!tripId) return;
    tripsApi
      .getSettlements(tripId)
      .then(apply)
      .catch(() => {
        // На ошибке оставляем null — компоненты откатятся на локальный расчёт.
        setStatus(null);
        setBalances(null);
        setOwnBalances(null);
        setTransactions(null);
      });
  }, [tripId, apply]);

  useEffect(() => {
    reload();
  }, [reload, sig]);

  // Финализация / отметка оплаты / reopen у других клиентов приходят по SignalR
  // с полным SettlementsResponse — применяем без рефетча.
  useEffect(() => {
    if (!tripId) return;
    return onHubEvent((event) => {
      if (event.type === 'settlement:updated' && event.payload.tripId === tripId) {
        apply(event.payload.settlements);
      }
    });
  }, [tripId, apply]);

  return { status, balances, ownBalances, transactions, reload, apply };
}
