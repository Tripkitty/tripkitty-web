import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useMe, useStore } from '../hooks/useStore';
import { TopBar } from './TopBar';

export function AppLayout() {
  const { loading } = useStore();
  const me = useMe();
  const location = useLocation();
  const isAuthRoute = location.pathname === '/auth';

  // Пока идёт инициализация — показываем пустой экран (не редиректим).
  if (loading) {
    return (
      <div className="app-shell" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100dvh' }}>
        <div style={{ color: 'var(--muted)', fontSize: 15 }}>Загрузка…</div>
      </div>
    );
  }

  if (!me && !isAuthRoute) return <Navigate to="/auth" replace />;
  if (me && isAuthRoute) return <Navigate to="/trips" replace />;

  return (
    <div className="app-shell">
      <TopBar />
      <Outlet />
    </div>
  );
}
