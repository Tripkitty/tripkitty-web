import { useState, type KeyboardEvent } from 'react';
import { Modal } from './Modal';
import { PhoneInput } from './PhoneInput';
import { BankPicker } from './BankPicker';
import { useStore } from '../hooks/useStore';
import { useToast } from '../hooks/useToast';
import { useBanks } from '../hooks/useBanks';
import { formatRuPhoneInput, ruPhoneDigits } from '../lib/format';
import { ApiError } from '../api/http';
import type { Guest, PaymentDetails, Trip } from '../types';

type Props = {
  trip: Trip;
  // null — добавление нового гостя, иначе — редактирование существующего.
  guest: Guest | null;
  onClose: () => void;
};

export function GuestModal({ trip, guest, onClose }: Props) {
  const { dispatch } = useStore();
  const toast = useToast();
  const { banks } = useBanks();
  const [last, setLast] = useState(guest?.lastName ?? '');
  const [first, setFirst] = useState(guest?.firstName ?? '');
  const [middle, setMiddle] = useState(guest?.middleName ?? '');
  const [phone, setPhone] = useState(guest?.paymentDetails?.phone ? formatRuPhoneInput(guest.paymentDetails.phone) : '');
  const [banksSel, setBanksSel] = useState<string[]>(guest?.paymentDetails?.banks ?? []);
  const [bad, setBad] = useState<{ last?: boolean; first?: boolean; pay?: boolean }>({});
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    const lastName = last.trim();
    const firstName = first.trim();
    const middleName = middle.trim();
    if (!lastName || !firstName) {
      setBad({ last: !lastName, first: !firstName });
      return toast.error('Введи фамилию и имя гостя');
    }
    // Реквизиты необязательны, но если начали — нужны и полный телефон, и хотя бы один банк.
    const digits = ruPhoneDigits(phone);
    const hasPay = digits.length > 0 || banksSel.length > 0;
    if (hasPay && (digits.length !== 10 || banksSel.length === 0)) {
      setBad({ pay: true });
      return toast.error('Для реквизитов гостя укажи телефон и хотя бы один банк');
    }

    setSaving(true);
    try {
      if (guest) {
        const hadPay = !!guest.paymentDetails?.phone;
        let paymentDetails: PaymentDetails | undefined;
        let clearPayment: boolean | undefined;
        if (hasPay) paymentDetails = { phone: '+7' + digits, banks: banksSel, label: null };
        else if (hadPay) clearPayment = true; // реквизиты были и очищены — сбрасываем на сервере
        await dispatch({ type: 'updateGuest', tripId: trip.id, guestId: guest.id, lastName, firstName, middleName, paymentDetails, clearPayment });
        toast.success('Данные гостя обновлены');
      } else {
        const paymentDetails = hasPay ? { phone: '+7' + digits, banks: banksSel, label: null } : null;
        // id и вычисленное name придут от сервера через dispatch в StoreContext
        await dispatch({ type: 'addGuest', tripId: trip.id, guest: { id: '', name: '', lastName, firstName, middleName, paymentDetails } });
        toast.success('Гость добавлен');
      }
      onClose();
    } catch (e) {
      if (e instanceof ApiError && (e.code === 'INVALID_PHONE' || e.code === 'INVALID_BANK')) {
        setBad({ pay: true });
        toast.error(e.code === 'INVALID_PHONE' ? 'Неверный номер телефона (нужен российский)' : 'Выбран недопустимый банк');
      } else if (e instanceof ApiError && e.field === 'lastName') { setBad({ last: true }); toast.error('Укажи фамилию'); }
      else if (e instanceof ApiError && e.field === 'firstName') { setBad({ first: true }); toast.error('Укажи имя'); }
      else if (e instanceof ApiError) toast.error(e.message);
      else toast.error('Не удалось сохранить данные гостя');
    } finally {
      setSaving(false);
    }
  };
  const onKey = (e: KeyboardEvent) => { if (e.key === 'Enter') submit(); };

  return (
    <Modal title={guest ? 'Редактировать гостя' : 'Добавить гостя'} onClose={onClose}>
      <div className="row" style={{ flexWrap: 'wrap' }}>
        <input
          className={'input' + (bad.last ? ' invalid' : '')}
          style={{ flex: 1, minWidth: 130 }}
          placeholder="Фамилия"
          value={last}
          onChange={(e) => { setLast(e.target.value); setBad((b) => ({ ...b, last: false })); }}
          onKeyDown={onKey}
          autoFocus
        />
        <input
          className={'input' + (bad.first ? ' invalid' : '')}
          style={{ flex: 1, minWidth: 130 }}
          placeholder="Имя"
          value={first}
          onChange={(e) => { setFirst(e.target.value); setBad((b) => ({ ...b, first: false })); }}
          onKeyDown={onKey}
        />
      </div>
      <div className="row">
        <input
          className="input"
          style={{ flex: 1 }}
          placeholder="Отчество (необязательно)"
          value={middle}
          onChange={(e) => setMiddle(e.target.value)}
          onKeyDown={onKey}
        />
      </div>

      {/* Реквизиты гостя для перевода по СБП — необязательно */}
      <div className="pay-banks-field">
        <span className="field-label">Реквизиты для перевода (необязательно)</span>
        <PhoneInput
          value={phone}
          invalid={bad.pay}
          onChange={(v) => { setPhone(v); setBad((b) => ({ ...b, pay: false })); }}
        />
        <BankPicker
          banks={banks}
          selected={banksSel}
          onChange={(codes) => { setBanksSel(codes); setBad((b) => ({ ...b, pay: false })); }}
          invalid={bad.pay}
        />
      </div>

      <div className="row" style={{ gap: 10, marginTop: 4 }}>
        <button type="button" className="btn chip-on sm" onClick={submit} disabled={saving}>
          {saving ? '…' : guest ? 'Сохранить' : 'Добавить гостя'}
        </button>
        <button type="button" className="link" onClick={onClose} disabled={saving}>Отмена</button>
      </div>
    </Modal>
  );
}
