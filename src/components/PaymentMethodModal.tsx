import { useState } from 'react';
import { Modal } from './Modal';
import { PhoneInput } from './PhoneInput';
import { BankPicker } from './BankPicker';
import { useToast } from '../hooks/useToast';
import { useBanks } from '../hooks/useBanks';
import { formatRuPhoneInput, ruPhoneDigits } from '../lib/format';
import { paymentMethods as pmApi, type ApiPaymentMethod } from '../api/api';
import { ApiError } from '../api/http';

type Props = {
  // null — добавление нового способа оплаты, иначе — редактирование существующего.
  method: ApiPaymentMethod | null;
  // true, если это будет первый способ пользователя (станет дефолтным на сервере).
  isFirst: boolean;
  onClose: () => void;
  onSaved: (method: ApiPaymentMethod) => void;
};

export function PaymentMethodModal({ method, isFirst, onClose, onSaved }: Props) {
  const toast = useToast();
  const { banks } = useBanks();
  const [label, setLabel] = useState(method?.label ?? '');
  const [phone, setPhone] = useState(method ? formatRuPhoneInput(method.phone) : '');
  const [pickedBanks, setPickedBanks] = useState<string[]>(method?.banks ?? []);
  const [bad, setBad] = useState<{ phone?: boolean; banks?: boolean }>({});
  const [busy, setBusy] = useState(false);

  const save = async () => {
    const digits = ruPhoneDigits(phone);
    const phoneOk = digits.length === 10;
    if (!phoneOk || pickedBanks.length === 0) {
      setBad({ phone: !phoneOk, banks: pickedBanks.length === 0 });
      return toast.error('Укажи телефон и хотя бы один банк');
    }
    const phoneValue = '+7' + digits;
    const lbl = label.trim() || null;

    setBusy(true);
    try {
      if (method) {
        const { paymentMethod } = await pmApi.patch(method.id, { phone: phoneValue, banks: pickedBanks, label: lbl });
        onSaved(paymentMethod);
      } else {
        const { paymentMethod } = await pmApi.create({ phone: phoneValue, banks: pickedBanks, label: lbl, isDefault: isFirst });
        onSaved(paymentMethod);
      }
      toast.success('Реквизиты сохранены');
      onClose();
    } catch (e) {
      if (e instanceof ApiError && e.code === 'INVALID_PHONE') {
        setBad({ phone: true });
        toast.error('Неверный номер телефона (нужен российский)');
      } else if (e instanceof ApiError && e.code === 'INVALID_BANK') {
        setBad({ banks: true });
        toast.error('Выбран недопустимый банк');
      } else if (e instanceof ApiError) {
        toast.error(e.message);
      } else {
        toast.error('Не удалось сохранить реквизиты');
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title={method ? 'Изменить реквизиты' : 'Добавить способ оплаты'} onClose={onClose}>
      <input
        className="input"
        placeholder="Метка (напр. «Основной»)"
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        autoFocus
      />
      <PhoneInput
        value={phone}
        invalid={bad.phone}
        onChange={(v) => { setPhone(v); setBad((b) => ({ ...b, phone: false })); }}
      />
      <div className="pay-banks-field">
        <span className="field-label">Банки для перевода</span>
        <BankPicker
          banks={banks}
          selected={pickedBanks}
          onChange={(codes) => { setPickedBanks(codes); setBad((b) => ({ ...b, banks: false })); }}
          invalid={bad.banks}
        />
      </div>
      <div className="row" style={{ gap: 10 }}>
        <button type="button" className="btn chip-on sm" onClick={save} disabled={busy}>
          {busy ? '…' : 'Сохранить'}
        </button>
        <button type="button" className="link" onClick={onClose} disabled={busy}>Отмена</button>
      </div>
    </Modal>
  );
}
