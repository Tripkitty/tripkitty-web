import { Modal } from './Modal';
import { Avatar } from './Avatar';
import { useStore } from '../hooks/useStore';
import { dispIni } from '../lib/participants';
import type { Trip, User } from '../types';

type Props = {
  trip: Trip;
  me: User;
  onClose: () => void;
};

export function AddParticipantModal({ trip, me, onClose }: Props) {
  const { db, dispatch } = useStore();
  const friends = me.friends.map((fid) => db.users[fid]).filter(Boolean);

  return (
    <Modal title="Добавить участника" onClose={onClose}>
      {friends.length > 0 ? (
        <div className="member-list">
          {friends.map((u) => {
            const added = trip.members.includes(u.id);
            return (
              <div key={u.id} className="member-row">
                <Avatar id={u.id} name={u.name} size={34} />
                <div className="member-main">
                  <div className="member-name">{dispIni(u.name)}</div>
                  {u.handle && <div className="member-sub">@{u.handle}</div>}
                </div>
                {added ? (
                  <span className="hint" style={{ flexShrink: 0 }}>Добавлен</span>
                ) : (
                  <button
                    type="button"
                    className="member-act"
                    title="Добавить в поездку"
                    onClick={() => dispatch({ type: 'addMember', tripId: trip.id, userId: u.id })}
                  >
                    +
                  </button>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="hint">Сначала добавь друзей на вкладке «Друзья»</div>
      )}
    </Modal>
  );
}
