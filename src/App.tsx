import { Navigate, Route, Routes } from 'react-router-dom';
import { AppLayout } from './components/AppLayout';
import { AuthPage } from './pages/AuthPage';
import { TripsListPage } from './pages/TripsListPage';
import { TripDetailPage } from './pages/TripDetailPage';
import { ProfilePage } from './pages/ProfilePage';
import { FriendsPage } from './pages/FriendsPage';
import { SettingsPage } from './pages/SettingsPage';
import { HistoryPage } from './pages/HistoryPage';

export default function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/auth" element={<AuthPage />} />
        <Route path="/trips" element={<TripsListPage />} />
        <Route path="/trips/:id" element={<TripDetailPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/friends" element={<FriendsPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/history" element={<HistoryPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/trips" replace />} />
    </Routes>
  );
}
