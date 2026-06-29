import { Navigate, Route, Routes } from 'react-router-dom';
import { AppLayout } from './components/AppLayout';
import { AuthPage } from './pages/AuthPage';
import { TripsListPage } from './pages/TripsListPage';
import { TripDetailPage } from './pages/TripDetailPage';
import { FriendsPage } from './pages/FriendsPage';

export default function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/auth" element={<AuthPage />} />
        <Route path="/trips" element={<TripsListPage />} />
        <Route path="/trips/:id" element={<TripDetailPage />} />
        <Route path="/friends" element={<FriendsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/trips" replace />} />
    </Routes>
  );
}
