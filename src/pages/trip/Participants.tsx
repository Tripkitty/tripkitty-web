import { useState, type KeyboardEvent } from 'react';
import { useStore } from '../../hooks/useStore';
import { useToast } from '../../hooks/useToast';
import { useBanks } from '../../hooks/useBanks';
import { dispIni } from '../../lib/participants';
import { formatRuPhoneInput, plural, ruPhoneDigits } from '../../lib/format';
import { Avatar } from '../../components/Avatar';
import { BankPicker } from '../../components/BankPicker';
import { PhoneInput } from '../../components/PhoneInput';
import { ApiError } from '../../api/http';
import type { Guest, Participant, PaymentDetails, Trip, User } from '../../types';

type Props = {
  trip: Trip;
  ps: Participant[];
  idDisp: Record<string, string>;
  idSub: Record<string, string>;
  me: User;
};

export function Participants({ trip, ps, idDisp, idSub, me }: Props) {
  const { db, dispatch } = useStore();
  const toast = useToast();
  const { banks } = useBanks();
  const [guestLast, setGuestLast] = useState('');
  const [guestFirst, setGuestFirst] = useState('');
  const [guestMiddle, setGuestMiddle] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [guestBanks, setGuestBanks] = useState<string[]>([]);
  const [guestBad, setGuestBad] = useState<{ last?: boolean; first?: boolean; pay?: boolean }>({});
  const [showGuestForm, setShowGuestForm] = useState(false);

  // Редактирование существующего гостя (ФИО + реквизиты).
  const [editId, setEditId] = useState<string | null>(null);
  const [ef, setEf] = useState({ last: '', first: '', middle: '', phone: '', banks: [] as string[] });
  const [efBad, setEfBad] = useState<{ last?: boolean; first?: boolean; pay?: boolean }>({});
  const [savingEdit, setSavingEdit] = useState(false);

  const startEditGuest = (g: Guest) => {
    setShowGuestForm(false);
    setEditId(g.id);
    setEf({
      last: g.lastName,
      first: g.firstName,
      middle: g.middleName,
      phone: g.paymentDetails?.phone ? formatRuPhoneInput(g.paymentDetails.phone) : '',
      banks: g.paymentDetails?.banks ?? [],
    });
    setEfBad({});
  };

  const saveEdit = async () => {
    if (!editId) return;
    const lastName = ef.last.trim();
    const firstName = ef.first.trim();
    const middleName = ef.middle.trim();
    if (!lastName || !firstName) {
      setEfBad({ last: !lastName, first: !firstName });
      return toast.error('Введи фамилию и имя гостя');
    }
    const digits = ruPhoneDigits(ef.phone);
    const hasPay = digits.length > 0 || ef.banks.length > 0;
    if (hasPay && (digits.length !== 10 || ef.banks.length === 0)) {
      setEfBad({ pay: true });
      return toast.error('Для реквизитов гостя укажи телефон и хотя бы один банк');
    }
    const hadPay = !!trip.guests.find((g) => g.id === editId)?.paymentDetails?.phone;
    let paymentDetails: PaymentDetails | undefined;
    let clearPayment: boolean | undefined;
    if (hasPay) paymentDetails = { phone: '+7' + digits, banks: ef.banks, label: null };
    else if (hadPay) clearPayment = true; // реквизиты были и очищены — сбрасываем на сервере

    setSavingEdit(true);
    try {
      await dispatch({ type: 'updateGuest', tripId: trip.id, guestId: editId, lastName, firstName, middleName, paymentDetails, clearPayment });
      setEditId(null);
      toast.success('Данные гостя обновлены');
    } catch (e) {
      if (e instanceof ApiError && (e.code === 'INVALID_PHONE' || e.code === 'INVALID_BANK')) {
        setEfBad({ pay: true });
        toast.error(e.code === 'INVALID_PHONE' ? 'Неверный номер телефона (нужен российский)' : 'Выбран недопустимый банк');
      } else if (e instanceof ApiError && e.field === 'lastName') { setEfBad({ last: true }); toast.error('Укажи фамилию'); }
      else if (e instanceof ApiError && e.field === 'firstName') { setEfBad({ first: true }); toast.error('Укажи имя'); }
      else if (e instanceof ApiError) toast.error(e.message);
      else toast.error('Не удалось сохранить данные гостя');
    } finally {
      setSavingEdit(false);
    }
  };
  const onEditKey = (e: KeyboardEvent) => { if (e.key === 'Enter') saveEdit(); };

  // Есть ли у гостя реквизиты для перевода (детали — на экране редактирования/взаиморасчётов).
  const guestHasPay = (p: Participant): boolean =>
    !!trip.guests.find((g) => g.id === p.id)?.paymentDetails?.phone;

  // Подпись строки аккаунта: @handle + роли «вы» / «создатель».
  const userSub = (p: Participant): string => {
    const parts: string[] = [];
    const u = db.users[p.id];
    if (u && u.handle) parts.push('@' + u.handle);
    if (p.isMe) parts.push('вы');
    if (p.isOwner) parts.push('создатель');
    return parts.join(' · ');
  };

  const addGuest = () => {
    const lastName = guestLast.trim();
    const firstName = guestFirst.trim();
    const middleName = guestMiddle.trim();
    if (!lastName || !firstName) {
      setGuestBad({ last: !lastName, first: !firstName });
      return toast.error('Введи фамилию и имя гостя');
    }
    // Реквизиты необязательны, но если начали — нужны и полный телефон, и хотя бы один банк.
    const digits = ruPhoneDigits(guestPhone);
    const hasPay = digits.length > 0 || guestBanks.length > 0;
    if (hasPay && (digits.length !== 10 || guestBanks.length === 0)) {
      setGuestBad({ pay: true });
      return toast.error('Для реквизитов гостя укажи телефон и хотя бы один банк');
    }
    const paymentDetails = hasPay ? { phone: '+7' + digits, banks: guestBanks, label: null } : null;
    // id и вычисленное name придут от сервера через dispatch в StoreContext
    dispatch({ type: 'addGuest', tripId: trip.id, guest: { id: '', name: '', lastName, firstName, middleName, paymentDetails } });
    setGuestLast('');
    setGuestFirst('');
    setGuestMiddle('');
    setGuestPhone('');
    setGuestBanks([]);
    setGuestBad({});
    setShowGuestForm(false);
  };
  const onGuestKey = (e: KeyboardEvent) => {
    if (e.key === 'Enter') addGuest();
  };

  // Друзья, которых ещё нет в поездке.
  const addable = me.friends.filter((fid) => !trip.members.includes(fid)).map((fid) => db.users[fid]).filter(Boolean);
  const addableHint =
    me.friends.length === 0 ? 'Сначала добавь друзей на вкладке «Друзья»' : 'Все друзья уже в поездке';

  // Две группы: участники с аккаунтом и гости.
  const accounts = ps.filter((p) => p.kind !== 'guest');
  const guests = ps.filter((p) => p.kind === 'guest');
  const countLabel =
    plural(accounts.length, 'участник', 'участника', 'участников') +
    (guests.length ? ` + ${plural(guests.length, 'гость', 'гостя', 'гостей')}` : '');

  return (
    <section className="trip-block">
      <div className="member-head">
        <label className="field-label">УЧАСТНИКИ</label>
        <span className="member-count">{countLabel}</span>
      </div>

      {/* Участники с аккаунтом */}
      <div className="member-group">
        <div className="member-group-head">
          <span>Зарегистрированные</span>
        </div>
        <div className="member-list">
          {accounts.map((p) => (
            <div key={p.id} className="member-row">
              <Avatar id={p.id} name={p.name} size={34} isMe={p.isMe} />
              <div className="member-main">
                <div className="member-name">{idDisp[p.id]}</div>
                {userSub(p) && <div className="member-sub">{userSub(p)}</div>}
              </div>
              {!p.isOwner && (
                <button
                  type="button"
                  className="member-act remove"
                  title="Убрать участника"
                  onClick={() => dispatch({ type: 'removeParticipant', tripId: trip.id, participantId: p.id })}
                >
                  ✕
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Гости */}
      <div className="member-group">
        <div className="member-group-head">
          <span>Гости</span>
          <button
            type="button"
            className="member-add-btn"
            onClick={() => { setShowGuestForm((v) => !v); setEditId(null); }}
          >
            {showGuestForm ? 'Свернуть' : '+ гость'}
          </button>
        </div>
        {guests.length > 0 ? (
          <div className="member-list">
            {guests.map((p) => {
              const hasPay = guestHasPay(p);
              return (
                <div key={p.id} className="member-row">
                  <Avatar id={p.id} name={p.name} size={34} />
                  <div className="member-main">
                    <div className="member-name">
                      {idDisp[p.id]}
                      {idSub[p.id] && <span className="member-dis"> · {idSub[p.id]}</span>}
                    </div>
                    <div className="member-sub">{hasPay ? '💳 реквизиты указаны' : 'нет реквизитов'}</div>
                  </div>
                  <button
                    type="button"
                    className="member-act"
                    title="Редактировать гостя"
                    onClick={() => {
                      const g = trip.guests.find((x) => x.id === p.id);
                      if (g) startEditGuest(g);
                    }}
                  >
                    ✎
                  </button>
                  <button
                    type="button"
                    className="member-act remove"
                    title="Убрать гостя"
                    onClick={() => dispatch({ type: 'removeParticipant', tripId: trip.id, participantId: p.id })}
                  >
                    ✕
                  </button>
                </div>
              );
            })}
          </div>
        ) : (
          !showGuestForm && <div className="hint">Гостей без аккаунта пока нет</div>
        )}

        {/* Форма добавления гостя */}
        {showGuestForm && (
          <div className="add-box">
            <div className="row" style={{ flexWrap: 'wrap' }}>
              <input
                className={'input' + (guestBad.last ? ' invalid' : '')}
                style={{ flex: 1, minWidth: 130 }}
                placeholder="Фамилия"
                value={guestLast}
                onChange={(e) => { setGuestLast(e.target.value); setGuestBad((b) => ({ ...b, last: false })); }}
                onKeyDown={onGuestKey}
              />
              <input
                className={'input' + (guestBad.first ? ' invalid' : '')}
                style={{ flex: 1, minWidth: 130 }}
                placeholder="Имя"
                value={guestFirst}
                onChange={(e) => { setGuestFirst(e.target.value); setGuestBad((b) => ({ ...b, first: false })); }}
                onKeyDown={onGuestKey}
              />
            </div>
            <div className="row">
              <input
                className="input"
                style={{ flex: 1 }}
                placeholder="Отчество (необязательно)"
                value={guestMiddle}
                onChange={(e) => setGuestMiddle(e.target.value)}
                onKeyDown={onGuestKey}
              />
            </div>

            {/* Реквизиты гостя для перевода по СБП — необязательно */}
            <div className="pay-banks-field">
              <span className="field-label">Реквизиты для перевода (необязательно)</span>
              <PhoneInput
                value={guestPhone}
                invalid={guestBad.pay}
                onChange={(v) => { setGuestPhone(v); setGuestBad((b) => ({ ...b, pay: false })); }}
              />
              <BankPicker
                banks={banks}
                selected={guestBanks}
                onChange={(codes) => { setGuestBanks(codes); setGuestBad((b) => ({ ...b, pay: false })); }}
                invalid={guestBad.pay}
              />
            </div>

            <div className="row" style={{ gap: 10 }}>
              <button type="button" className="btn chip-on sm" onClick={addGuest}>
                Добавить гостя
              </button>
              <button type="button" className="link" onClick={() => setShowGuestForm(false)}>Отмена</button>
            </div>
          </div>
        )}
      </div>

      {/* Редактирование гостя */}
      {editId && (
        <div className="add-box">
          <div className="hint" style={{ fontWeight: 600 }}>Редактировать гостя</div>
          <div className="row" style={{ flexWrap: 'wrap' }}>
            <input
              className={'input' + (efBad.last ? ' invalid' : '')}
              style={{ flex: 1, minWidth: 130 }}
              placeholder="Фамилия"
              value={ef.last}
              onChange={(e) => { setEf((f) => ({ ...f, last: e.target.value })); setEfBad((b) => ({ ...b, last: false })); }}
              onKeyDown={onEditKey}
            />
            <input
              className={'input' + (efBad.first ? ' invalid' : '')}
              style={{ flex: 1, minWidth: 130 }}
              placeholder="Имя"
              value={ef.first}
              onChange={(e) => { setEf((f) => ({ ...f, first: e.target.value })); setEfBad((b) => ({ ...b, first: false })); }}
              onKeyDown={onEditKey}
            />
          </div>
          <div className="row">
            <input
              className="input"
              style={{ flex: 1 }}
              placeholder="Отчество (необязательно)"
              value={ef.middle}
              onChange={(e) => setEf((f) => ({ ...f, middle: e.target.value }))}
              onKeyDown={onEditKey}
            />
          </div>

          <div className="pay-banks-field">
            <span className="field-label">Реквизиты для перевода (необязательно)</span>
            <PhoneInput
              value={ef.phone}
              invalid={efBad.pay}
              onChange={(v) => { setEf((f) => ({ ...f, phone: v })); setEfBad((b) => ({ ...b, pay: false })); }}
            />
            <BankPicker
              banks={banks}
              selected={ef.banks}
              onChange={(codes) => { setEf((f) => ({ ...f, banks: codes })); setEfBad((b) => ({ ...b, pay: false })); }}
              invalid={efBad.pay}
            />
          </div>

          <div className="row" style={{ gap: 10 }}>
            <button type="button" className="btn chip-on sm" onClick={saveEdit} disabled={savingEdit}>
              {savingEdit ? '…' : 'Сохранить'}
            </button>
            <button type="button" className="link" onClick={() => setEditId(null)} disabled={savingEdit}>Отмена</button>
          </div>
        </div>
      )}

      {/* Добавление участников */}
      <div className="add-box">
        <div className="hint" style={{ fontWeight: 600 }}>
          Добавить из друзей
        </div>
        {addable.length > 0 ? (
          <div className="chips-wrap">
            {addable.map((u) => (
              <button
                key={u.id}
                type="button"
                className="participant-chip add"
                onClick={() => dispatch({ type: 'addMember', tripId: trip.id, userId: u.id })}
              >
                <Avatar id={u.id} name={u.name} size={23} />
                <span style={{ fontWeight: 600 }}>{dispIni(u.name)}</span>
                <span style={{ color: 'var(--accent)', fontWeight: 700, fontSize: 16 }}>+</span>
              </button>
            ))}
          </div>
        ) : (
          <div className="hint">{addableHint}</div>
        )}
      </div>
    </section>
  );
}
