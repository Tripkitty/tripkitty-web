import { useState, type KeyboardEvent } from 'react';
import { useStore } from '../../hooks/useStore';
import { useToast } from '../../hooks/useToast';
import { dispIni } from '../../lib/participants';
import { Avatar } from '../../components/Avatar';
import type { Participant, Trip, User } from '../../types';

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
  const [guestLast, setGuestLast] = useState('');
  const [guestFirst, setGuestFirst] = useState('');
  const [guestMiddle, setGuestMiddle] = useState('');
  const [guestBad, setGuestBad] = useState<{ last?: boolean; first?: boolean }>({});

  // Тег участника: @handle / гость[ N] + роли «вы» / «создатель».
  const tagFor = (p: Participant): string => {
    const parts: string[] = [];
    if (p.kind === 'friend') {
      const u = db.users[p.id];
      if (u && u.handle) parts.push('@' + u.handle);
    } else {
      parts.push(idSub[p.id] || 'гость');
    }
    if (p.isMe) parts.push('вы');
    if (p.isOwner) parts.push('создатель');
    return parts.length ? '· ' + parts.join(' · ') : '';
  };

  const addGuest = () => {
    const lastName = guestLast.trim();
    const firstName = guestFirst.trim();
    const middleName = guestMiddle.trim();
    if (!lastName || !firstName) {
      setGuestBad({ last: !lastName, first: !firstName });
      return toast.error('Введи фамилию и имя гостя');
    }
    // id и вычисленное name придут от сервера через dispatch в StoreContext
    dispatch({ type: 'addGuest', tripId: trip.id, guest: { id: '', name: '', lastName, firstName, middleName } });
    setGuestLast('');
    setGuestFirst('');
    setGuestMiddle('');
  };
  const onGuestKey = (e: KeyboardEvent) => {
    if (e.key === 'Enter') addGuest();
  };

  // Друзья, которых ещё нет в поездке.
  const addable = me.friends.filter((fid) => !trip.members.includes(fid)).map((fid) => db.users[fid]).filter(Boolean);
  const addableHint =
    me.friends.length === 0 ? 'Сначала добавь друзей на вкладке «Друзья»' : 'Все друзья уже в поездке';

  return (
    <section className="trip-block">
      <label className="field-label">УЧАСТНИКИ</label>

      <div className="chips-wrap">
        {ps.map((p) => (
          <span key={p.id} className="participant-chip">
            <Avatar id={p.id} name={p.name} size={22} isMe={p.isMe} />
            <span style={{ fontWeight: 600 }}>{idDisp[p.id]}</span>
            {tagFor(p) && <span className="chip-tag">{tagFor(p)}</span>}
            {!p.isOwner && (
              <button
                type="button"
                className="chip-remove"
                title="Убрать участника"
                onClick={() => dispatch({ type: 'removeParticipant', tripId: trip.id, participantId: p.id })}
              >
                ✕
              </button>
            )}
          </span>
        ))}
      </div>

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

        <div className="hint" style={{ fontWeight: 600 }}>
          …или гость без аккаунта
        </div>
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
          <button type="button" className="btn chip-on sm" onClick={addGuest}>
            Гость
          </button>
        </div>
      </div>
    </section>
  );
}
