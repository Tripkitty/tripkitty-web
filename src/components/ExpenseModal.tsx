import { useState } from 'react';
import { Modal } from './Modal';
import { useStore } from '../hooks/useStore';
import { useToast } from '../hooks/useToast';
import { fmt } from '../lib/format';
import type { Expense, ExpenseShare, Participant, SplitType, Trip } from '../types';

type Props = {
  trip: Trip;
  ps: Participant[];
  idName: Record<string, string>;
  expense: Expense;
  onClose: () => void;
};

const SPLIT_LABELS: Record<SplitType, string> = {
  0: 'Поровну',
  1: 'По частям',
  2: 'Своя сумма',
};

export function ExpenseModal({ trip, ps, idName, expense, onClose }: Props) {
  const { dispatch } = useStore();
  const toast = useToast();

  const [title, setTitle] = useState(expense.title);
  const [amount, setAmount] = useState(String(expense.amount));
  const [payer, setPayer] = useState(expense.payer);
  const [splitType, setSplitType] = useState<SplitType>(expense.splitType);
  const includedIds = new Set(expense.share.map((s) => s.participantId));
  const [off, setOff] = useState<Record<string, boolean>>(
    Object.fromEntries(ps.filter((p) => !includedIds.has(p.id)).map((p) => [p.id, true])),
  );
  const [weights, setWeights] = useState<Record<string, string>>(
    Object.fromEntries(expense.share.filter((s) => s.weight != null).map((s) => [s.participantId, String(s.weight)])),
  );
  const [amounts, setAmounts] = useState<Record<string, string>>(
    Object.fromEntries(expense.share.filter((s) => s.amount != null).map((s) => [s.participantId, String(s.amount)])),
  );
  const [bad, setBad] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const clearBad = (k: string) => setBad((b) => (b[k] ? { ...b, [k]: false } : b));

  const effPayer = ps.some((p) => p.id === payer) ? payer : ps[0] ? ps[0].id : '';
  const isOn = (id: string) => !off[id];
  const sel = ps.filter((p) => isOn(p.id));

  const toggle = (id: string) => setOff((o) => ({ ...o, [id]: !o[id] }));

  const amt = parseFloat(amount);
  const enteredSum = sel.reduce((a, p) => a + (parseFloat(amounts[p.id]) || 0), 0);
  const rest = Math.round(((amt || 0) - enteredSum) * 100) / 100;

  const submit = async () => {
    const t = title.trim();
    if (!t) {
      setBad({ title: true });
      return toast.error('Напиши, на что потратили');
    }
    if (!amt || amt <= 0) {
      setBad({ amount: true });
      return toast.error('Укажи сумму больше нуля');
    }
    if (!sel.length) return toast.error('Выбери, между кем делим');
    if (!effPayer) return toast.error('Добавь хотя бы одного участника');

    let share: ExpenseShare[];
    if (splitType === 1) {
      share = sel.map((p) => ({ participantId: p.id, weight: parseFloat(weights[p.id] ?? '') || 1 }));
      const badIds = share.filter((s) => (s.weight as number) <= 0).map((s) => s.participantId);
      if (badIds.length) {
        setBad(Object.fromEntries(badIds.map((id) => [id, true])));
        return toast.error('Части должны быть больше нуля');
      }
    } else if (splitType === 2) {
      share = sel.map((p) => ({ participantId: p.id, amount: parseFloat(amounts[p.id] ?? '') || 0 }));
      const badIds = share.filter((s) => (s.amount as number) <= 0).map((s) => s.participantId);
      if (badIds.length) {
        setBad(Object.fromEntries(badIds.map((id) => [id, true])));
        return toast.error('Укажи сумму каждого участника');
      }
      if (Math.abs(rest) > 0.01) {
        return toast.error(
          rest > 0
            ? 'Осталось распределить ' + fmt(rest, trip.cur)
            : 'Распределено больше общей суммы на ' + fmt(-rest, trip.cur),
        );
      }
    } else {
      share = sel.map((p) => ({ participantId: p.id }));
    }

    setSaving(true);
    try {
      await dispatch({
        type: 'editExpense',
        tripId: trip.id,
        expense: { ...expense, title: t, amount: amt, payer: effPayer, splitType, share },
      });
      toast.success('Расход обновлён');
      onClose();
    } catch {
      toast.error('Не удалось сохранить расход');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title="Редактировать расход" onClose={onClose}>
      <label className="field-label">На что потратили</label>
      <input
        className={'input' + (bad.title ? ' invalid' : '')}
        placeholder="На что потратили (отель, такси…)"
        value={title}
        onChange={(e) => { setTitle(e.target.value); clearBad('title'); }}
        autoFocus
      />

      <div className="row">
        <input
          className={'input mono' + (bad.amount ? ' invalid' : '')}
          style={{ flex: 1, minWidth: 120 }}
          type="number"
          placeholder="Сумма"
          value={amount}
          onChange={(e) => { setAmount(e.target.value); clearBad('amount'); }}
        />
        <select
          className="input"
          style={{ flex: 1, minWidth: 140 }}
          value={effPayer}
          onChange={(e) => setPayer(e.target.value)}
        >
          {ps.map((p) => (
            <option key={p.id} value={p.id}>
              {idName[p.id]}
            </option>
          ))}
        </select>
      </div>

      <div>
        <div className="hint" style={{ fontWeight: 600, marginBottom: 8 }}>
          Как делим:
        </div>
        <select
          className="input"
          value={splitType}
          onChange={(e) => setSplitType(Number(e.target.value) as SplitType)}
        >
          {([0, 1, 2] as SplitType[]).map((t) => (
            <option key={t} value={t}>
              {SPLIT_LABELS[t]}
            </option>
          ))}
        </select>
      </div>

      <div>
        <div className="hint" style={{ fontWeight: 600, marginBottom: 8 }}>
          Делим между:
        </div>
        <div className="chips-wrap">
          {ps.map((p) => (
            <button
              key={p.id}
              type="button"
              className={'chip' + (isOn(p.id) ? ' on' : '')}
              onClick={() => toggle(p.id)}
            >
              {idName[p.id]}
            </button>
          ))}
        </div>
      </div>

      {splitType === 1 && sel.length > 0 && (
        <div>
          <div className="hint" style={{ fontWeight: 600, marginBottom: 8 }}>
            Части (например, 2 — за двоих):
          </div>
          <div className="split-list">
            {sel.map((p) => (
              <div key={p.id} className="split-row">
                <span className="split-name">{idName[p.id]}</span>
                <input
                  className={'input mono split-input' + (bad[p.id] ? ' invalid' : '')}
                  type="number"
                  min="0"
                  step="1"
                  placeholder="1"
                  value={weights[p.id] ?? ''}
                  onChange={(e) => { setWeights((w) => ({ ...w, [p.id]: e.target.value })); clearBad(p.id); }}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {splitType === 2 && sel.length > 0 && (
        <div>
          <div className="hint" style={{ fontWeight: 600, marginBottom: 8 }}>
            Сумма каждого:
          </div>
          <div className="split-list">
            {sel.map((p) => (
              <div key={p.id} className="split-row">
                <span className="split-name">{idName[p.id]}</span>
                <input
                  className={'input mono split-input' + (bad[p.id] ? ' invalid' : '')}
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0"
                  value={amounts[p.id] ?? ''}
                  onChange={(e) => { setAmounts((a) => ({ ...a, [p.id]: e.target.value })); clearBad(p.id); }}
                />
              </div>
            ))}
          </div>
          {amt > 0 && (
            <div className="hint" style={{ marginTop: 8 }}>
              {Math.abs(rest) <= 0.01
                ? 'Вся сумма распределена ✓'
                : rest > 0
                  ? 'Осталось распределить ' + fmt(rest, trip.cur)
                  : 'Лишние ' + fmt(-rest, trip.cur)}
            </div>
          )}
        </div>
      )}

      <div className="row" style={{ gap: 10, marginTop: 4 }}>
        <button type="button" className="btn chip-on sm" onClick={submit} disabled={saving}>
          {saving ? '…' : 'Сохранить'}
        </button>
        <button type="button" className="link" onClick={onClose} disabled={saving}>Отмена</button>
      </div>
    </Modal>
  );
}
