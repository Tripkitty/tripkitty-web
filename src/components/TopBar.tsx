import { NavLink, useLocation } from 'react-router-dom';
import { useMe } from '../hooks/useStore';
import { ThemeSwitcher } from './ThemeSwitcher';

// Постоянный верхний бар для всех залогиненных view.
export function TopBar() {
  const me = useMe();
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
  const onProfile = location.pathname.startsWith('/profile');
  const onFriends = location.pathname.startsWith('/friends');
  const onSettings = location.pathname.startsWith('/settings');
  const incomingCount = me.incoming.length;

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
          <NavLink to="/profile" className={'seg-btn nav' + (onProfile ? ' active' : '')}>
            Профиль
          </NavLink>
        </div>

        <NavLink
          to="/settings"
          className={'icon-btn' + (onSettings ? ' active' : '')}
          title="Настройки"
          aria-label="Настройки"
        >
          <GearIcon />
        </NavLink>
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

function GearIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}
