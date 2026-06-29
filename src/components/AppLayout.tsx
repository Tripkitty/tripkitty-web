import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useMe } from '../hooks/useStore';
import { TopBar } from './TopBar';

// Каркас приложения: верхний бар + текущий view. Гард авторизации.
export function AppLayout() {
  const me = useMe();
  const location = useLocation();
  const isAuthRoute = location.pathname === '/auth';

  // Не залогинен и не на /auth → на экран входа.
  if (!me && !isAuthRoute) return <Navigate to="/auth" replace />;
  // Залогинен, но на /auth → к списку поездок.
  if (me && isAuthRoute) return <Navigate to="/trips" replace />;

  return (
    <div className="app-shell">
      <TopBar />
      <Outlet />
    </div>
  );
}
