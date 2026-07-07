import { useState, type KeyboardEvent } from 'react';
import { useMe, useStore } from '../hooks/useStore';
import { useToast } from '../hooks/useToast';
import { disp } from '../lib/format';
import { HeaderBand } from '../components/HeaderBand';
import { Avatar } from '../components/Avatar';
import { friends as friendsApi } from '../api/api';
import { ApiError } from '../api/http';

// Друзья: добавление по @логину, входящие заявки и список друзей.
export function FriendsPage() {
  const { db, dispatch } = useStore();
  const me = useMe()!;
  const toast = useToast();

  const [handle, setHandle] = useState('');
  const [handleBad, setHandleBad] = useState(false);
  const [busy, setBusy] = useState(false);

  const sendRequest = async () => {
    const h = handle.trim().replace(/^@+/, '').toLowerCase();
    if (!h) {
      setHandleBad(true);
      return toast.error('Введи @логин друга');
    }
    if (h === me.handle) return toast.info('Это вы 🙂');

    setBusy(true);
    try {
      // Ищем пользователя на сервере, чтобы получить id.
      const { user: found } = await friendsApi.searchByHandle(h);

      if (me.friends.includes(found.id)) return toast.info(disp(found.name) + ' уже у вас в друзьях');

      // Если есть входящая заявка — принимаем её.
      if (me.incoming.includes(found.id)) {
        await dispatch({ type: 'acceptFriend', meId: me.id, fromId: found.id });
        toast.success('Вы теперь друзья!');
      } else {
        await dispatch({ type: 'friendRequest', fromId: me.id, toId: found.id });
        toast.success('Запрос отправлен ' + disp(found.name) + '. Под его аккаунтом можно принять.');
      }
      setHandle('');
    } catch (e) {
      if (e instanceof ApiError && e.code === 'NOT_FOUND') toast.error('Пользователь @' + h + ' не найден');
      else if (e instanceof ApiError) toast.error(e.message);
      else toast.error('Ошибка отправки запроса');
    } finally {
      setBusy(false);
    }
  };

  const onKey = (e: KeyboardEvent) => { if (e.key === 'Enter') sendRequest(); };

  const friendUsers = me.friends.map((id) => db.users[id]).filter(Boolean);
  const incomingUsers = me.incoming.map((id) => db.users[id]).filter(Boolean);

  return (
    <div className="view friends-view">
      <div className="card">
        <HeaderBand eyebrow="Совместные расчёты" title="Друзья" decoSize={130} titleSize="clamp(20px, 4.4vw, 26px)" />
        <div className="card-body">
          {/* Добавить друга по @логину */}
          <section className="card-section">
            <label className="field-label">Добавить друга по @логину</label>
            <div className="row">
              <div className="handle-wrap" style={{ flex: 1 }}>
                <span className="at">@</span>
                <input
                  className={'input' + (handleBad ? ' invalid' : '')}
                  placeholder="логин друга"
                  value={handle}
                  onChange={(e) => { setHandle(e.target.value); setHandleBad(false); }}
                  onKeyDown={onKey}
                />
              </div>
              <button type="button" className="btn" onClick={sendRequest} disabled={busy}>
                {busy ? '…' : 'Отправить'}
              </button>
            </div>
          </section>

          {/* Входящие заявки */}
          {incomingUsers.length > 0 && (
            <section className="card-section">
              <label className="field-label">Заявки в друзья</label>
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
          <section className="card-section">
            <label className="field-label">Мои друзья</label>
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
