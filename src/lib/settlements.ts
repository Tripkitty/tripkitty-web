import type { Expense, Participant } from '../types';

export type Transaction = { from: string; to: string; amount: number };
export type Settlements = { bal: Record<string, number>; tx: Transaction[] };

// Доля каждого участника в расходе по splitType (зеркалит серверную логику):
// 0 (Equal) — amount / n; 1 (ByShares) — пропорционально weight; 2 (ByAmounts) — точные суммы.
export function expenseShareAmounts(e: Expense): Record<string, number> {
  const res: Record<string, number> = {};
  const sh = e.share || [];
  if (!sh.length) return res;
  if (e.splitType === 2) {
    sh.forEach((s) => {
      res[s.participantId] = s.amount ?? 0;
    });
  } else if (e.splitType === 1) {
    const totalW = sh.reduce((a, s) => a + (s.weight ?? 0), 0);
    if (totalW <= 0) return res;
    sh.forEach((s) => {
      res[s.participantId] = (e.amount * (s.weight ?? 0)) / totalW;
    });
  } else {
    const each = e.amount / sh.length;
    sh.forEach((s) => {
      res[s.participantId] = each;
    });
  }
  return res;
}

// Расчёт долгов с минимизацией числа транзакций. Порт из прототипа, расширен splitType.
// Плательщику начисляется полная сумма расхода, каждому участнику доли списывается его
// часть по expenseShareAmounts. Затем жадно сводим крупнейшего должника с крупнейшим кредитором.
export function computeSettlements(participants: Participant[], expenses: Expense[]): Settlements {
  const bal: Record<string, number> = {};
  participants.forEach((p) => {
    bal[p.id] = 0;
  });
  expenses.forEach((e) => {
    const sh = (e.share || []).filter((s) => bal[s.participantId] !== undefined);
    if (!sh.length || bal[e.payer] === undefined) return;
    bal[e.payer] += e.amount;
    const parts = expenseShareAmounts({ ...e, share: sh });
    Object.entries(parts).forEach(([id, v]) => {
      bal[id] -= v;
    });
  });
  Object.keys(bal).forEach((k) => {
    bal[k] = Math.round(bal[k] * 100) / 100;
  });

  const debt: { id: string; v: number }[] = [];
  const cred: { id: string; v: number }[] = [];
  Object.keys(bal).forEach((id) => {
    const v = bal[id];
    if (v < -0.005) debt.push({ id, v: -v });
    else if (v > 0.005) cred.push({ id, v });
  });
  debt.sort((a, b) => b.v - a.v);
  cred.sort((a, b) => b.v - a.v);

  const tx: Transaction[] = [];
  let i = 0;
  let j = 0;
  while (i < debt.length && j < cred.length) {
    const m = Math.min(debt[i].v, cred[j].v);
    tx.push({ from: debt[i].id, to: cred[j].id, amount: Math.round(m * 100) / 100 });
    debt[i].v -= m;
    cred[j].v -= m;
    if (debt[i].v < 0.005) i++;
    if (cred[j].v < 0.005) j++;
  }
  return { bal, tx };
}
