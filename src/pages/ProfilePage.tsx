import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMe, useStore } from '../hooks/useStore';
import { disp } from '../lib/format';
import { HeaderBand } from '../components/HeaderBand';
import { Avatar } from '../components/Avatar';
import { FioModal } from '../components/FioModal';
import { PaymentMethods } from './PaymentMethods';

// Профиль: карточка данных пользователя + способы оплаты.
export function ProfilePage() {
  const { logout: apiLogout } = useStore();
  const me = useMe()!;
  const navigate = useNavigate();

  const [editFio, setEditFio] = useState(false);

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
            <div className="profile-field">
              <span className="field-label">ФИО</span>
              <div className="row" style={{ justifyContent: 'space-between', alignItems: 'baseline', gap: 10 }}>
                <span className="value">{fullFio}</span>
                <button type="button" className="link accent" onClick={() => setEditFio(true)}>Изменить</button>
              </div>
            </div>
            <ProfileField label="Логин" value={'@' + me.handle} />
            <ProfileField label="Почта" value={me.email || '—'} />
          </div>
        </div>
      </div>

      {editFio && <FioModal me={me} onClose={() => setEditFio(false)} />}

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
