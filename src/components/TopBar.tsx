import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useMe, useStore } from '../hooks/useStore';
import { disp } from '../lib/format';
import { Avatar } from './Avatar';
import { ThemeSwitcher } from './ThemeSwitcher';
import { NotificationToggle } from './NotificationToggle';

// Постоянный верхний бар для всех залогиненных view.
export function TopBar() {
  const me = useMe();
  const { logout: apiLogout } = useStore();
  const navigate = useNavigate();
  const location = useLocation();

  if (!me) {
    // На экране авторизации показываем только бренд и переключатель тем.
    return (
      <div className="topbar">
        <Brand />
        <div className="topbar-right">
          <ThemeSwitcher />
        </div>
      </div>
    );
  }

  const onTrips = location.pathname.startsWith('/trips');
  const onFriends = location.pathname.startsWith('/friends');
  const incomingCount = me.incoming.length;

  const logout = () => {
    apiLogout().finally(() => navigate('/auth'));
  };

  return (
    <div className="topbar">
      <Brand />
      <div className="topbar-right">
        <div className="pill-group">
          <NavLink to="/trips" className={'seg-btn nav' + (onTrips ? ' active' : '')}>
            Поездки
          </NavLink>
          <NavLink to="/friends" className={'seg-btn nav' + (onFriends ? ' active' : '')}>
            Друзья
            {incomingCount > 0 && <span className="nav-badge">{incomingCount}</span>}
          </NavLink>
        </div>

        <div className="user-pill">
          <Avatar id={me.id} name={me.name} size={28} isMe />
          <span className="name">{disp(me.name)}</span>
          <button type="button" className="logout-link" onClick={logout}>
            Выйти
          </button>
        </div>

        <NotificationToggle />
        <ThemeSwitcher />
      </div>
    </div>
  );
}

function Brand() {
  return (
    <div className="brand">
      <span className="brand-dot" />
      ДЕЛИМ&nbsp;СЧЁТ
    </div>
  );
}
