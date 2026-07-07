import { useState, type KeyboardEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMe, useStore } from '../hooks/useStore';
import { useToast } from '../hooks/useToast';
import { disp } from '../lib/format';
import { HeaderBand } from '../components/HeaderBand';
import { Avatar } from '../components/Avatar';
import { PaymentMethods } from './PaymentMethods';
import { friends as friendsApi } from '../api/api';
import { ApiError } from '../api/http';

// Профиль: карточка данных пользователя + управление друзьями.
export function ProfilePage() {
  const { db, dispatch, logout: apiLogout } = useStore();
  const me = useMe()!;
  const navigate = useNavigate();
  const toast = useToast();

  const [handle, setHandle] = useState('');
  const [handleBad, setHandleBad] = useState(false);
  const [busy, setBusy] = useState(false);

  // Редактирование ФИО.
  const [editFio, setEditFio] = useState(false);
  const [fio, setFio] = useState({ last: '', first: '', middle: '' });
  const [fioBad, setFioBad] = useState<{ last?: boolean; first?: boolean }>({});
  const [savingFio, setSavingFio] = useState(false);

  const startEditFio = () => {
    setFio({ last: me.lastName, first: me.firstName, middle: me.middleName });
    setFioBad({});
    setEditFio(true);
  };

  const saveFio = async () => {
    const lastName = fio.last.trim();
    const firstName = fio.first.trim();
    if (!lastName || !firstName) {
      setFioBad({ last: !lastName, first: !firstName });
      return toast.error('Фамилия и имя обязательны');
    }
    setSavingFio(true);
    try {
      // middleName: '' сбрасывает отчество на сервере — так и передаём.
      await dispatch({ type: 'updateProfile', lastName, firstName, middleName: fio.middle.trim() });
      setEditFio(false);
      toast.success('Профиль обновлён');
    } catch (e) {
      if (e instanceof ApiError && e.field === 'lastName') { setFioBad({ last: true }); toast.error('Укажи фамилию'); }
      else if (e instanceof ApiError && e.field === 'firstName') { setFioBad({ first: true }); toast.error('Укажи имя'); }
      else if (e instanceof ApiError) toast.error(e.message);
      else toast.error('Не удалось сохранить профиль');
    } finally {
      setSavingFio(false);
    }
  };

  const logout = () => {
    apiLogout().finally(() => navigate('/auth'));
  };

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

  // Полное ФИО одной строкой; фолбэк на серверное name для старых записей без раздельных полей.
  const fullFio = [me.lastName, me.firstName, me.middleName].filter(Boolean).join(' ') || me.name;

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
            {editFio ? (
              <div className="profile-field">
                <span className="field-label">ФИО</span>
                <div className="row" style={{ flexWrap: 'wrap', gap: 8 }}>
                  <input
                    className={'input' + (fioBad.last ? ' invalid' : '')}
                    style={{ flex: 1, minWidth: 130 }}
                    placeholder="Фамилия"
                    value={fio.last}
                    onChange={(e) => { setFio((f) => ({ ...f, last: e.target.value })); setFioBad((b) => ({ ...b, last: false })); }}
                  />
                  <input
                    className={'input' + (fioBad.first ? ' invalid' : '')}
                    style={{ flex: 1, minWidth: 130 }}
                    placeholder="Имя"
                    value={fio.first}
                    onChange={(e) => { setFio((f) => ({ ...f, first: e.target.value })); setFioBad((b) => ({ ...b, first: false })); }}
                  />
                  <input
                    className="input"
                    style={{ flex: 1, minWidth: 130 }}
                    placeholder="Отчество (необязательно)"
                    value={fio.middle}
                    onChange={(e) => setFio((f) => ({ ...f, middle: e.target.value }))}
                  />
                </div>
                <div className="row" style={{ gap: 10, marginTop: 8 }}>
                  <button type="button" className="btn sm" onClick={saveFio} disabled={savingFio}>
                    {savingFio ? '…' : 'Сохранить'}
                  </button>
                  <button type="button" className="link" onClick={() => setEditFio(false)} disabled={savingFio}>Отмена</button>
                </div>
              </div>
            ) : (
              <div className="profile-field">
                <span className="field-label">ФИО</span>
                <div className="row" style={{ justifyContent: 'space-between', alignItems: 'baseline', gap: 10 }}>
                  <span className="value">{fullFio}</span>
                  <button type="button" className="link accent" onClick={startEditFio}>Изменить</button>
                </div>
              </div>
            )}
            <ProfileField label="Логин" value={'@' + me.handle} />
            <ProfileField label="Почта" value={me.email || '—'} />
          </div>
        </div>
      </div>

      {/* Карточка способов оплаты (СБП) */}
      <PaymentMethods />

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

function ProfileField({ label, value }: { label: string; value: string }) {
  return (
    <div className="profile-field">
      <span className="field-label">{label}</span>
      <span className="value">{value}</span>
    </div>
  );
}
