import { useState } from 'react';
import { Modal } from './Modal';
import { PhoneInput } from './PhoneInput';
import { BankPicker } from './BankPicker';
import { useToast } from '../hooks/useToast';
import { useBanks } from '../hooks/useBanks';
import { formatPhone, formatRuPhoneInput, ruPhoneDigits } from '../lib/format';
import { trips as tripsApi, type ApiPaymentMethod, type ApiTripPayment } from '../api/api';
import { ApiError } from '../api/http';

type Props = {
  tripId: string;
  current: ApiTripPayment;
  methods: ApiPaymentMethod[];
  onClose: () => void;
  onChanged: (next: ApiTripPayment) => void;
};

// Реквизиты для перевода в конкретной поездке: выбор из способов профиля или ручной ввод override.
export function TripPaymentModal({ tripId, current, methods, onClose, onChanged }: Props) {
  const toast = useToast();
  const { banks } = useBanks();
  const [phone, setPhone] = useState(formatRuPhoneInput(current.payment?.phone ?? ''));
  const [pickedBanks, setPickedBanks] = useState<string[]>(current.payment?.banks ?? []);
  const [bad, setBad] = useState<{ phone?: boolean; banks?: boolean }>({});
  const [busy, setBusy] = useState(false);

  const applyMethod = async (m: ApiPaymentMethod) => {
    setBusy(true);
    try {
      const next = await tripsApi.setMyPayment(tripId, { phone: m.phone, banks: m.banks, label: m.label });
      onChanged(next);
      toast.success('Реквизиты для поездки обновлены');
      onClose();
    } catch {
      toast.error('Не удалось задать реквизиты');
    } finally {
      setBusy(false);
    }
  };

  const saveOverride = async () => {
    const digits = ruPhoneDigits(phone);
    const phoneOk = digits.length === 10;
    if (!phoneOk || pickedBanks.length === 0) {
      setBad({ phone: !phoneOk, banks: pickedBanks.length === 0 });
      return toast.error('Укажи телефон и хотя бы один банк');
    }
    setBusy(true);
    try {
      const next = await tripsApi.setMyPayment(tripId, { phone: '+7' + digits, banks: pickedBanks, label: null });
      onChanged(next);
      toast.success('Реквизиты для поездки обновлены');
      onClose();
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
      onChanged(next);
      toast.success('Реквизиты поездки сброшены к профилю');
      onClose();
    } catch {
      toast.error('Не удалось сбросить реквизиты');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title="Реквизиты для поездки" onClose={onClose}>
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
        <PhoneInput
          value={phone}
          invalid={bad.phone}
          onChange={(v) => { setPhone(v); setBad((b) => ({ ...b, phone: false })); }}
        />
        <BankPicker
          banks={banks}
          selected={pickedBanks}
          onChange={(codes) => { setPickedBanks(codes); setBad((b) => ({ ...b, banks: false })); }}
          invalid={bad.banks}
        />
      </div>

      <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
        <button type="button" className="btn chip-on sm" onClick={saveOverride} disabled={busy}>
          {busy ? '…' : 'Сохранить'}
        </button>
        {current.source === 'trip' && (
          <button type="button" className="link" onClick={reset} disabled={busy}>Сбросить к профилю</button>
        )}
        <button type="button" className="link" onClick={onClose} disabled={busy}>Отмена</button>
      </div>
    </Modal>
  );
}
