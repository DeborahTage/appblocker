import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';

export function ProtectedRoute() {
  const mentor = useAuthStore((s) => s.mentor);
  if (!mentor) return <Navigate to="/login" replace />;
  return <Outlet />;
}
