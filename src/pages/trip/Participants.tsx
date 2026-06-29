import { useState, type KeyboardEvent } from 'react';
import { useStore } from '../../hooks/useStore';
import { disp } from '../../lib/format';
import { uid } from '../../lib/id';
import { Avatar } from '../../components/Avatar';
import type { Participant, Trip, User } from '../../types';

type Props = {
  trip: Trip;
  ps: Participant[];
  idSub: Record<string, string>;
  me: User;
};

export function Participants({ trip, ps, idSub, me }: Props) {
  const { db, dispatch } = useStore();
  const [guestName, setGuestName] = useState('');

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
    const name = guestName.trim();
    if (!name) return;
    dispatch({ type: 'addGuest', tripId: trip.id, id: 'g_' + uid(), name });
    setGuestName('');
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
            <span style={{ fontWeight: 600 }}>{p.name}</span>
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
                <span style={{ fontWeight: 600 }}>{disp(u.name)}</span>
                <span style={{ color: 'var(--accent)', fontWeight: 700, fontSize: 16 }}>+</span>
              </button>
            ))}
          </div>
        ) : (
          <div className="hint">{addableHint}</div>
        )}

        <div className="row">
          <input
            className="input"
            style={{ flex: 1 }}
            placeholder="…или гость без аккаунта"
            value={guestName}
            onChange={(e) => setGuestName(e.target.value)}
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
