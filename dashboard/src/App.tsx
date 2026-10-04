import { useEffect, useState } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { api } from './api/client';
import { useAuthStore } from './stores/authStore';
import { Layout } from './components/Layout';
import { ProtectedRoute } from './components/ProtectedRoute';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { StudentsPage } from './pages/StudentsPage';
import { SessionsPage } from './pages/SessionsPage';
import { CreateSessionPage } from './pages/CreateSessionPage';
import { SessionDetailPage } from './pages/SessionDetailPage';
import { SettingsPage } from './pages/SettingsPage';

export function App() {
  const setMentor = useAuthStore((s) => s.setMentor);
  const [booting, setBooting] = useState(true);

  useEffect(() => {
    void api
      .me()
      .then((res) => {
        setMentor({
          id: res.mentor.id,
          email: res.mentor.email,
          name: res.mentor.name ?? res.mentor.email,
        });
      })
      .catch(() => setMentor(null))
      .finally(() => setBooting(false));
  }, [setMentor]);

  if (booting) {
    return (
      <div className="flex min-h-screen items-center justify-center text-slate-500">Loading…</div>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<Layout />}>
          <Route index element={<DashboardPage />} />
          <Route path="students" element={<StudentsPage />} />
          <Route path="sessions" element={<SessionsPage />} />
          <Route path="sessions/new" element={<CreateSessionPage />} />
          <Route path="sessions/:id" element={<SessionDetailPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
