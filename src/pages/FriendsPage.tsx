import { useState, type KeyboardEvent } from 'react';
import { useMe, useStore } from '../hooks/useStore';
import { disp } from '../lib/format';
import { HeaderBand } from '../components/HeaderBand';
import { Avatar } from '../components/Avatar';
import { friends as friendsApi } from '../api/api';
import { ApiError } from '../api/http';

export function FriendsPage() {
  const { db, dispatch } = useStore();
  const me = useMe()!;

  const [handle, setHandle] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  const sendRequest = async () => {
    const h = handle.trim().replace(/^@+/, '').toLowerCase();
    if (!h) return setMsg('Введи @логин друга');
    if (h === me.handle) return setMsg('Это вы 🙂');

    setBusy(true);
    setMsg('');
    try {
      // Ищем пользователя на сервере, чтобы получить id.
      const { user: found } = await friendsApi.searchByHandle(h);

      if (me.friends.includes(found.id)) return setMsg(disp(found.name) + ' уже у вас в друзьях');

      // Если есть входящая заявка — принимаем её.
      if (me.incoming.includes(found.id)) {
        await dispatch({ type: 'acceptFriend', meId: me.id, fromId: found.id });
        setMsg('Вы теперь друзья!');
      } else {
        await dispatch({ type: 'friendRequest', fromId: me.id, toId: found.id });
        setMsg('Запрос отправлен ' + disp(found.name) + '. Под его аккаунтом можно принять.');
      }
      setHandle('');
    } catch (e) {
      if (e instanceof ApiError && e.code === 'NOT_FOUND') setMsg('Пользователь @' + h + ' не найден');
      else if (e instanceof ApiError) setMsg(e.message);
      else setMsg('Ошибка отправки запроса');
    } finally {
      setBusy(false);
    }
  };

  const onKey = (e: KeyboardEvent) => { if (e.key === 'Enter') sendRequest(); };

  const friendUsers = me.friends.map((id) => db.users[id]).filter(Boolean);
  const incomingUsers = me.incoming.map((id) => db.users[id]).filter(Boolean);

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
              <button type="button" className="btn" onClick={sendRequest} disabled={busy}>
                {busy ? '…' : 'Отправить'}
              </button>
            </div>
            {msg && <div style={{ color: 'var(--accent)', fontSize: 13.5, fontWeight: 600 }}>{msg}</div>}
          </section>

          {/* Входящие заявки */}
          {incomingUsers.length > 0 && (
            <section className="friends-section">
              <label className="field-label">ЗАЯВКИ В ДРУЗЬЯ</label>
              {incomingUsers.map((u) => (
                <div key={u.id} className="friend-row">
                  <Avatar id={u.id} name={u.name} size={36} />
                  <div className="friend-meta">
                    <span className="friend-name">{disp(u.name)}</span>
                    <span className="friend-handle">@{u.handle}</span>
                  </div>
                  <div className="row" style={{ gap: 10 }}>
                    <button type="button" className="btn sm" onClick={() => dispatch({ type: 'acceptFriend', meId: me.id, fromId: u.id })}>
                      Принять
                    </button>
                    <button type="button" className="link danger" onClick={() => dispatch({ type: 'declineFriend', meId: me.id, fromId: u.id })}>
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
            {friendUsers.length === 0 ? (
              <div className="empty">Пока никого. Добавь друга по @логину выше ↑</div>
            ) : (
              friendUsers.map((u) => (
                <div key={u.id} className="friend-row">
                  <Avatar id={u.id} name={u.name} size={38} />
                  <div className="friend-meta">
                    <span className="friend-name">{disp(u.name)}</span>
                    <span className="friend-handle">@{u.handle}</span>
                  </div>
                  <button type="button" className="link danger" onClick={() => dispatch({ type: 'removeFriend', meId: me.id, friendId: u.id })}>
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
