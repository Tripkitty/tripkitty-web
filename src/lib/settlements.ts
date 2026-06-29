import type { Expense, Participant } from '../types';

export type Transaction = { from: string; to: string; amount: number };
export type Settlements = { bal: Record<string, number>; tx: Transaction[] };

// Расчёт долгов с минимизацией числа транзакций. Порт из прототипа — без изменений.
// Плательщику начисляется полная сумма расхода, каждому участнику доли списывается
// amount / share.length. Затем жадно сводим крупнейшего должника с крупнейшим кредитором.
export function computeSettlements(participants: Participant[], expenses: Expense[]): Settlements {
  const bal: Record<string, number> = {};
  participants.forEach((p) => {
    bal[p.id] = 0;
  });
  expenses.forEach((e) => {
    const sh = (e.share || []).filter((id) => bal[id] !== undefined);
    if (!sh.length || bal[e.payer] === undefined) return;
    bal[e.payer] += e.amount;
    const each = e.amount / sh.length;
    sh.forEach((id) => {
      bal[id] -= each;
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
