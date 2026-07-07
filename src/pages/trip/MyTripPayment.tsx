import { useEffect, useState } from 'react';
import { useToast } from '../../hooks/useToast';
import { useBanks } from '../../hooks/useBanks';
import { formatPhone } from '../../lib/format';
import { BankPicker } from '../../components/BankPicker';
import { trips as tripsApi, paymentMethods as pmApi, type ApiPaymentMethod, type ApiTripPayment } from '../../api/api';
import { ApiError } from '../../api/http';

type Props = {
  tripId: string;
  // Реквизиты влияют на toPayment во взаиморасчётах — просим родителя перезапросить их.
  onChanged?: () => void;
};

const SOURCE_LABEL: Record<ApiTripPayment['source'], string> = {
  trip: 'заданы для этой поездки',
  profile: 'из профиля (по умолчанию)',
  none: '',
};

// Мои реквизиты для перевода в конкретной поездке: показывает эффективные реквизиты
// (override поездки или дефолт профиля) и позволяет выбрать/ввести/сбросить их.
export function MyTripPayment({ tripId, onChanged }: Props) {
  const toast = useToast();
  const { banks, bankName } = useBanks();

  const [state, setState] = useState<ApiTripPayment | null>(null);
  const [methods, setMethods] = useState<ApiPaymentMethod[]>([]);
  const [editing, setEditing] = useState(false);
  const [phone, setPhone] = useState('');
  const [pickedBanks, setPickedBanks] = useState<string[]>([]);
  const [bad, setBad] = useState<{ phone?: boolean; banks?: boolean }>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    tripsApi.getMyPayment(tripId).then(setState).catch(() => {});
    pmApi.list().then((r) => setMethods(r.paymentMethods)).catch(() => {});
  }, [tripId]);

  const openEditor = () => {
    setPhone(state?.payment?.phone ?? '');
    setPickedBanks(state?.payment?.banks ?? []);
    setBad({});
    setEditing(true);
  };

  const afterChange = (next: ApiTripPayment) => {
    setState(next);
    setEditing(false);
    onChanged?.();
  };

  // Выбрать один из своих способов — задаёт override поездки его телефоном/банками.
  const applyMethod = async (m: ApiPaymentMethod) => {
    setBusy(true);
    try {
      const next = await tripsApi.setMyPayment(tripId, { phone: m.phone, banks: m.banks, label: m.label });
      afterChange(next);
      toast.success('Реквизиты для поездки обновлены');
    } catch {
      toast.error('Не удалось задать реквизиты');
    } finally {
      setBusy(false);
    }
  };

  const saveOverride = async () => {
    const p = phone.trim();
    const digits = p.replace(/\D/g, '');
    const phoneOk = digits.length === 10 || digits.length === 11;
    if (!phoneOk || pickedBanks.length === 0) {
      setBad({ phone: !phoneOk, banks: pickedBanks.length === 0 });
      return toast.error('Укажи телефон и хотя бы один банк');
    }
    setBusy(true);
    try {
      const next = await tripsApi.setMyPayment(tripId, { phone: p, banks: pickedBanks, label: null });
      afterChange(next);
      toast.success('Реквизиты для поездки обновлены');
    } catch (e) {
      if (e instanceof ApiError && e.code === 'INVALID_PHONE') { setBad({ phone: true }); toast.error('Неверный номер телефона'); }
      else if (e instanceof ApiError && e.code === 'INVALID_BANK') { setBad({ banks: true }); toast.error('Недопустимый банк'); }
      else toast.error('Не удалось сохранить реквизиты');
    } finally {
      setBusy(false);
    }
  };

  // Сбросить override — реквизиты снова возьмутся из дефолтного способа профиля.
  const reset = async () => {
    setBusy(true);
    try {
      const next = await tripsApi.setMyPayment(tripId, null);
      afterChange(next);
      toast.success('Реквизиты поездки сброшены к профилю');
    } catch {
      toast.error('Не удалось сбросить реквизиты');
    } finally {
      setBusy(false);
    }
  };

  if (!state) return null;

  return (
    <section className="trip-block">
      <label className="field-label">Мои реквизиты для перевода</label>

      {state.source === 'none' ? (
        <div className="hint">
          Реквизиты не заданы — участники не увидят, куда вернуть тебе долг. Добавь способ оплаты
          в профиле или задай реквизиты для этой поездки.
        </div>
      ) : (
        state.payment && (
          <div className="pay-current">
            <span className="pay-method-phone mono">{formatPhone(state.payment.phone)}</span>
            <span className="pay-method-banks">{state.payment.banks.map(bankName).join(' · ')}</span>
            <span className="hint" style={{ marginTop: 0 }}>{SOURCE_LABEL[state.source]}</span>
          </div>
        )
      )}

      {!editing ? (
        <button type="button" className="link accent" style={{ alignSelf: 'flex-start' }} onClick={openEditor}>
          {state.source === 'none' ? 'Задать реквизиты' : 'Изменить'}
        </button>
      ) : (
        <div className="pay-editor">
          {methods.length > 0 && (
            <div className="pay-banks-field">
              <span className="field-label">Выбрать из своих способов</span>
              <div className="chips-wrap">
                {methods.map((m) => (
                  <button key={m.id} type="button" className="chip" disabled={busy} onClick={() => applyMethod(m)}>
                    {m.label || formatPhone(m.phone)}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="pay-banks-field">
            <span className="field-label">…или ввести для этой поездки</span>
            <input
              className={'input' + (bad.phone ? ' invalid' : '')}
              type="tel"
              inputMode="tel"
              placeholder="Телефон (+7…)"
              value={phone}
              onChange={(e) => { setPhone(e.target.value); setBad((b) => ({ ...b, phone: false })); }}
            />
            <BankPicker
              banks={banks}
              selected={pickedBanks}
              onChange={(codes) => { setPickedBanks(codes); setBad((b) => ({ ...b, banks: false })); }}
              invalid={bad.banks}
            />
          </div>

          <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
            <button type="button" className="btn sm" onClick={saveOverride} disabled={busy}>
              {busy ? '…' : 'Сохранить'}
            </button>
            {state.source === 'trip' && (
              <button type="button" className="link" onClick={reset} disabled={busy}>Сбросить к профилю</button>
            )}
            <button type="button" className="link" onClick={() => setEditing(false)} disabled={busy}>Отмена</button>
          </div>
        </div>
      )}
    </section>
  );
}
