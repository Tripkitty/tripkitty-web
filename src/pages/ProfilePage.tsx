import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMe, useStore } from '../hooks/useStore';
import { useToast } from '../hooks/useToast';
import { disp } from '../lib/format';
import { HeaderBand } from '../components/HeaderBand';
import { Avatar } from '../components/Avatar';
import { PaymentMethods } from './PaymentMethods';
import { ApiError } from '../api/http';

// Профиль: карточка данных пользователя + способы оплаты.
export function ProfilePage() {
  const { dispatch, logout: apiLogout } = useStore();
  const me = useMe()!;
  const navigate = useNavigate();
  const toast = useToast();

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
