import { useState, type KeyboardEvent } from 'react';
import { useMe, useStore } from '../hooks/useStore';
import { disp } from '../lib/format';
import { HeaderBand } from '../components/HeaderBand';
import { Avatar } from '../components/Avatar';

export function FriendsPage() {
  const { db, dispatch } = useStore();
  const me = useMe()!;

  const [handle, setHandle] = useState('');
  const [msg, setMsg] = useState('');

  const sendRequest = () => {
    const h = handle.trim().replace(/^@+/, '').toLowerCase();
    if (!h) return setMsg('Введи @логин друга');
    const target = Object.values(db.users).find((u) => u.handle === h);
    if (!target) return setMsg('Пользователь @' + h + ' не найден');
    if (target.id === me.id) return setMsg('Это вы 🙂');
    if (me.friends.includes(target.id)) return setMsg(disp(target.name) + ' уже у вас в друзьях');
    if (me.outgoing.includes(target.id)) return setMsg('Запрос уже отправлен');
    // Если друг уже отправил мне заявку — принимаем сразу.
    if (me.incoming.includes(target.id)) {
      dispatch({ type: 'acceptFriend', meId: me.id, fromId: target.id });
      setMsg('Вы теперь друзья!');
      setHandle('');
      return;
    }
    dispatch({ type: 'friendRequest', fromId: me.id, toId: target.id });
    setMsg('Запрос отправлен ' + disp(target.name) + '. Под его аккаунтом можно принять.');
    setHandle('');
  };

  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Enter') sendRequest();
  };

  const friends = me.friends.map((id) => db.users[id]).filter(Boolean);
  const incoming = me.incoming.map((id) => db.users[id]).filter(Boolean);

  return (
    <div className="view" style={{ maxWidth: 640 }}>
      <div className="card">
        <HeaderBand eyebrow="СОВМЕСТНЫЕ РАСЧЁТЫ" title="Друзья" />

        <div className="friends-body">
          {/* Добавить друга по @логину */}
          <section className="friends-section">
            <label className="field-label">ДОБАВИТЬ ДРУГА ПО @ЛОГИНУ</label>
            <div className="row">
              <div className="handle-wrap" style={{ flex: 1 }}>
                <span className="at">@</span>
                <input
                  className="input"
                  placeholder="логин друга"
                  value={handle}
                  onChange={(e) => setHandle(e.target.value)}
                  onKeyDown={onKey}
                />
              </div>
              <button type="button" className="btn" onClick={sendRequest}>
                Отправить
              </button>
            </div>
            {msg && (
              <div style={{ color: 'var(--accent)', fontSize: 13.5, fontWeight: 600 }}>{msg}</div>
            )}
          </section>

          {/* Входящие заявки */}
          {incoming.length > 0 && (
            <section className="friends-section">
              <label className="field-label">ЗАЯВКИ В ДРУЗЬЯ</label>
              {incoming.map((u) => (
                <div key={u.id} className="friend-row">
                  <Avatar id={u.id} name={u.name} size={36} />
                  <div className="friend-meta">
                    <span className="friend-name">{disp(u.name)}</span>
                    <span className="friend-handle">@{u.handle}</span>
                  </div>
                  <div className="row" style={{ gap: 10 }}>
                    <button
                      type="button"
                      className="btn sm"
                      onClick={() => dispatch({ type: 'acceptFriend', meId: me.id, fromId: u.id })}
                    >
                      Принять
                    </button>
                    <button
                      type="button"
                      className="link danger"
                      onClick={() => dispatch({ type: 'declineFriend', meId: me.id, fromId: u.id })}
                    >
                      Отклонить
                    </button>
                  </div>
                </div>
              ))}
            </section>
          )}

          {/* Мои друзья */}
          <section className="friends-section">
            <label className="field-label">МОИ ДРУЗЬЯ</label>
            {friends.length === 0 ? (
              <div className="empty">Пока никого. Добавь друга по @логину выше ↑</div>
            ) : (
              friends.map((u) => (
                <div key={u.id} className="friend-row">
                  <Avatar id={u.id} name={u.name} size={38} />
                  <div className="friend-meta">
                    <span className="friend-name">{disp(u.name)}</span>
                    <span className="friend-handle">@{u.handle}</span>
                  </div>
                  <button
                    type="button"
                    className="link danger"
                    onClick={() => dispatch({ type: 'removeFriend', meId: me.id, friendId: u.id })}
                  >
                    Удалить
                  </button>
                </div>
              ))
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
