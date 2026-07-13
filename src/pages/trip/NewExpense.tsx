import { useState } from 'react';
import { useStore } from '../../hooks/useStore';
import { useToast } from '../../hooks/useToast';
import { ApiError } from '../../api/http';
import { fmt } from '../../lib/format';
import type { Expense, ExpenseShare, Participant, SplitType, Trip, TripStatus } from '../../types';

type Props = {
  trip: Trip;
  ps: Participant[];
  idName: Record<string, string>;
  status: TripStatus;
};

const SPLIT_LABELS: Record<SplitType, string> = {
  0: 'Поровну',
  1: 'По частям',
  2: 'Своя сумма',
};

export function NewExpense({ trip, ps, idName, status }: Props) {
  const { sessionUserId, dispatch } = useStore();
  const toast = useToast();

  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [payer, setPayer] = useState<string>(sessionUserId || '');
  const [splitType, setSplitType] = useState<SplitType>(0);
  // Храним только явно ВЫКЛЮЧЕННых участников: по умолчанию делим между всеми,
  // поэтому новые участники автоматически «включены», а выбывшие в наборе не мешают.
  // Это позволяет синхронизироваться с составом без useEffect.
  const [off, setOff] = useState<Record<string, boolean>>({});
  // Веса (splitType 1) и точные суммы (splitType 2) по id участника; пустая строка = не задано.
  const [weights, setWeights] = useState<Record<string, string>>({});
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  // Невалидные поля: ключ 'amount' — общая сумма, id участника — его часть/сумма.
  // Подсветка снимается при вводе в поле.
  const [bad, setBad] = useState<Record<string, boolean>>({});
  const clearBad = (k: string) => setBad((b) => (b[k] ? { ...b, [k]: false } : b));

  // Скидка (необязательна): при withDiscount "Сумма" — это сумма ДО скидки (grossAmount),
  // итоговая (netAmount) считается автоматически и не вводится вручную.
  const [withDiscount, setWithDiscount] = useState(false);
  const [discountMode, setDiscountMode] = useState<'percent' | 'amount'>('percent');
  const [discountValue, setDiscountValue] = useState('');

  // Общий бюджет (§4.4): живое спонсорство поездки — дефолт для нового расхода.
  // Пару можно выключить («в этом расходе платит сам за себя»); храним только
  // выключенных подопечных, по аналогии с off.
  const [spOff, setSpOff] = useState<Record<string, boolean>>({});

  // Эффективный плательщик: выбранный, если он ещё в составе, иначе первый участник.
  const effPayer = ps.some((p) => p.id === payer) ? payer : ps[0] ? ps[0].id : '';
  const isOn = (id: string) => !off[id];
  const sel = ps.filter((p) => isOn(p.id));

  const toggle = (id: string) => setOff((o) => ({ ...o, [id]: !o[id] }));
  const toggleSp = (id: string) => setSpOff((o) => ({ ...o, [id]: !o[id] }));

  // Пары «подопечный → спонсор», значимые для этого расхода: подопечный делит его или платит.
  const liveSponsors = trip.sponsors ?? {};
  const relevantPairs = Object.entries(liveSponsors).filter(
    ([dep]) => sel.some((p) => p.id === dep) || dep === effPayer,
  );

  const gross = withDiscount ? parseFloat(amount) || 0 : 0;
  const discNum = parseFloat(discountValue) || 0;
  const discountAmountComputed = discountMode === 'percent' ? Math.round(gross * discNum) / 100 : discNum;
  const netAmount = Math.round((gross - discountAmountComputed) * 100) / 100;
  const amt = withDiscount ? netAmount : parseFloat(amount);
  // Сумма введённых точных сумм — для подсказки «осталось распределить».
  const enteredSum = sel.reduce((a, p) => a + (parseFloat(amounts[p.id]) || 0), 0);
  const rest = Math.round(((amt || 0) - enteredSum) * 100) / 100;

  const add = async () => {
    const t = title.trim();
    if (!t) {
      setBad({ title: true });
      return toast.error('Напиши, на что потратили');
    }
    if (withDiscount) {
      if (!gross || gross <= 0) {
        setBad({ amount: true });
        return toast.error('Укажи сумму больше нуля');
      }
      if (discountMode === 'percent' && (discNum < 0 || discNum > 100)) {
        setBad({ discount: true });
        return toast.error('Скидка должна быть от 0 до 100%');
      }
      if (discountMode === 'amount' && discNum < 0) {
        setBad({ discount: true });
        return toast.error('Скидка не может быть отрицательной');
      }
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

    // sponsors шлём только если пользователь выключил хоть одну значимую пару —
    // иначе undefined, и сервер сам снапшотит живое спонсорство поездки.
    const spChanged = relevantPairs.some(([dep]) => spOff[dep]);
    const sponsorsMap = spChanged
      ? Object.fromEntries(Object.entries(liveSponsors).filter(([dep]) => !spOff[dep]))
      : undefined;

    const exp: Expense = {
      id: '', // id придёт от сервера через dispatch
      title: t,
      amount: amt,
      payer: effPayer,
      splitType,
      share,
      createdBy: sessionUserId!,
      grossAmount: withDiscount ? gross : undefined,
      discountPercent: withDiscount && discountMode === 'percent' ? discNum : undefined,
      discountAmount: withDiscount && discountMode === 'amount' ? discNum : undefined,
      sponsors: sponsorsMap,
    };
    try {
      await dispatch({ type: 'addExpense', tripId: trip.id, expense: exp });
    } catch (err) {
      const code = err instanceof ApiError ? err.code : null;
      return toast.error(
        code === 'INVALID_SPONSORS'
          ? 'Общий бюджет в поездке изменился — проверь пары и попробуй снова'
          : code === 'TRIP_SETTLING'
            ? 'Подсчёт завершён — добавление расходов недоступно'
            : 'Не удалось добавить расход',
      );
    }

    setTitle('');
    setAmount('');
    setOff({}); // делёж снова на всех
    setWeights({});
    setAmounts({});
    setBad({});
    setWithDiscount(false);
    setDiscountMode('percent');
    setDiscountValue('');
    setSpOff({});
  };

  // Подсчёт зафиксирован (settling/settled) — мутации денег заблокированы сервером (409 TRIP_SETTLING).
  if (status !== 'active') {
    return (
      <section className="trip-block">
        <label className="field-label">НОВЫЙ РАСХОД</label>
        <div className="hint">
          Подсчёт завершён — добавление расходов недоступно.
          Владелец может переоткрыть подсчёт в блоке «Как рассчитаться».
        </div>
      </section>
    );
  }

  return (
    <section className="trip-block">
      <label className="field-label">НОВЫЙ РАСХОД</label>

      <input
        className={'input' + (bad.title ? ' invalid' : '')}
        placeholder="На что потратили (отель, такси…)"
        value={title}
        onChange={(e) => { setTitle(e.target.value); clearBad('title'); }}
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
        <button
          type="button"
          className={'chip' + (withDiscount ? ' on' : '')}
          onClick={() => setWithDiscount((v) => !v)}
        >
          Со скидкой
        </button>
      </div>

      {withDiscount && (
        <div>
          <div className="row">
            <select
              className="input"
              style={{ flex: 1, minWidth: 90 }}
              value={discountMode}
              onChange={(e) => setDiscountMode(e.target.value as 'percent' | 'amount')}
            >
              <option value="percent">%</option>
              <option value="amount">сумма</option>
            </select>
            <input
              className={'input mono' + (bad.discount ? ' invalid' : '')}
              style={{ flex: 1, minWidth: 100 }}
              type="number"
              placeholder={discountMode === 'percent' ? '10' : '100'}
              value={discountValue}
              onChange={(e) => { setDiscountValue(e.target.value); clearBad('discount'); }}
            />
          </div>
          {gross > 0 && (
            <div className="hint" style={{ marginTop: 4 }}>
              Итого после скидки: {fmt(netAmount, trip.cur)}
            </div>
          )}
        </div>
      )}

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

      {relevantPairs.length > 0 && (
        <div>
          <div className="hint" style={{ fontWeight: 600, marginBottom: 8 }}>
            Общий бюджет (выключи, если в этом расходе платит сам за себя):
          </div>
          <div className="chips-wrap">
            {relevantPairs.map(([dep, sp]) => (
              <button
                key={dep}
                type="button"
                className={'chip' + (!spOff[dep] ? ' on' : '')}
                onClick={() => toggleSp(dep)}
              >
                за {idName[dep]} платит {idName[sp]}
              </button>
            ))}
          </div>
        </div>
      )}

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

      <button type="button" className="btn" onClick={add}>
        Добавить расход
      </button>
    </section>
  );
}
