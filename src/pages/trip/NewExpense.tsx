import { useState } from 'react';
import { useStore } from '../../hooks/useStore';
import { uid } from '../../lib/id';
import type { Expense, Participant, Trip } from '../../types';

type Props = {
  trip: Trip;
  ps: Participant[];
  idName: Record<string, string>;
};

export function NewExpense({ trip, ps, idName }: Props) {
  const { sessionUserId, dispatch } = useStore();

  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [payer, setPayer] = useState<string>(sessionUserId || '');
  // Храним только явно ВЫКЛЮЧЕННых участников: по умолчанию делим между всеми,
  // поэтому новые участники автоматически «включены», а выбывшие в наборе не мешают.
  // Это позволяет синхронизироваться с составом без useEffect.
  const [off, setOff] = useState<Record<string, boolean>>({});

  // Эффективный плательщик: выбранный, если он ещё в составе, иначе первый участник.
  const effPayer = ps.some((p) => p.id === payer) ? payer : ps[0] ? ps[0].id : '';
  const isOn = (id: string) => !off[id];

  const toggle = (id: string) => setOff((o) => ({ ...o, [id]: !o[id] }));

  const add = () => {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) return alert('Укажи сумму больше нуля');
    const sh = ps.filter((p) => isOn(p.id)).map((p) => p.id);
    if (!sh.length) return alert('Выбери, между кем делим');
    if (!effPayer) return alert('Добавь хотя бы одного участника');

    const exp: Expense = {
      id: uid(),
      title: title.trim() || 'Расход',
      amount: amt,
      payer: effPayer,
      share: sh,
      createdBy: sessionUserId!,
    };
    dispatch({ type: 'addExpense', tripId: trip.id, expense: exp });

    setTitle('');
    setAmount('');
    setOff({}); // делёж снова на всех
  };

  return (
    <section className="trip-block">
      <label className="field-label">НОВЫЙ РАСХОД</label>

      <input
        className="input"
        placeholder="На что потратили (отель, такси…)"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />

      <div className="row">
        <input
          className="input mono"
          style={{ flex: 1, minWidth: 120 }}
          type="number"
          placeholder="Сумма"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
        <select
          className="input"
          style={{ flex: 1, minWidth: 140 }}
          value={effPayer}
          onChange={(e) => setPayer(e.target.value)}
        >
          <option value="" disabled>
            Кто платил
          </option>
          {ps.map((p) => (
            <option key={p.id} value={p.id}>
              {idName[p.id]}
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

      <button type="button" className="btn" onClick={add}>
        Добавить расход
      </button>
    </section>
  );
}
