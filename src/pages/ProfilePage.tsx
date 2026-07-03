import { useState, type KeyboardEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMe, useStore } from '../hooks/useStore';
import { disp } from '../lib/format';
import { HeaderBand } from '../components/HeaderBand';
import { Avatar } from '../components/Avatar';
import { friends as friendsApi } from '../api/api';
import { ApiError } from '../api/http';

// Профиль: карточка данных пользователя + управление друзьями.
export function ProfilePage() {
  const { db, dispatch, logout: apiLogout } = useStore();
  const me = useMe()!;
  const navigate = useNavigate();

  const [handle, setHandle] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  const logout = () => {
    apiLogout().finally(() => navigate('/auth'));
  };

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
    <div className="view profile-view">
      {/* Карточка профиля */}
      <div className="card">
        <HeaderBand eyebrow="Личный кабинет" title="Профиль" />
        <div className="card-body">
          <div className="profile-head">
            <Avatar id={me.id} name={me.name} size={64} isMe />
            <div className="profile-id">
              <span className="profile-name">{disp(me.name)}</span>
              <span className="friend-handle">@{me.handle}</span>
            </div>
            <button type="button" className="link danger" onClick={logout}>
              Выйти
            </button>
          </div>

          <div className="profile-fields">
            <ProfileField label="ФИО" value={me.name} />
            <ProfileField label="Логин" value={'@' + me.handle} />
            <ProfileField label="Почта" value={me.email || '—'} />
          </div>
        </div>
      </div>

      {/* Карточка друзей */}
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

function ProfileField({ label, value }: { label: string; value: string }) {
  return (
    <div className="profile-field">
      <span className="field-label">{label}</span>
      <span className="value">{value}</span>
    </div>
  );
}
