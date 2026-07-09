import { useState } from 'react';
import { useStore } from '../../hooks/useStore';
import { dispIni } from '../../lib/participants';
import { plural } from '../../lib/format';
import { Avatar } from '../../components/Avatar';
import { GuestModal } from '../../components/GuestModal';
import type { Guest, Participant, Trip, User } from '../../types';

type Props = {
  trip: Trip;
  ps: Participant[];
  idDisp: Record<string, string>;
  idSub: Record<string, string>;
  me: User;
};

export function Participants({ trip, ps, idDisp, idSub, me }: Props) {
  const { db, dispatch } = useStore();
  // null — модалка закрыта; { guest: null } — добавление, { guest } — редактирование.
  const [guestModal, setGuestModal] = useState<{ guest: Guest | null } | null>(null);

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
            onClick={() => setGuestModal({ guest: null })}
          >
            + гость
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
                      if (g) setGuestModal({ guest: g });
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
          <div className="hint">Гостей без аккаунта пока нет</div>
        )}
      </div>

      {guestModal && (
        <GuestModal trip={trip} guest={guestModal.guest} onClose={() => setGuestModal(null)} />
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
