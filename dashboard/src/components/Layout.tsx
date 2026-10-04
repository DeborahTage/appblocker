import { NavLink, Outlet } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { api } from '../api/client';

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `rounded-lg px-3 py-2 text-sm font-medium ${
    isActive ? 'bg-accent text-white' : 'text-slate-600 hover:bg-slate-100'
  }`;

export function Layout() {
  const mentor = useAuthStore((s) => s.mentor);
  const setMentor = useAuthStore((s) => s.setMentor);

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <div className="flex items-center gap-6">
            <span className="text-lg font-semibold text-ink-900">FocusMentor</span>
            <nav className="flex gap-1">
              <NavLink to="/" end className={linkClass}>
                Dashboard
              </NavLink>
              <NavLink to="/students" className={linkClass}>
                Students
              </NavLink>
              <NavLink to="/sessions" className={linkClass}>
                Sessions
              </NavLink>
              <NavLink to="/settings" className={linkClass}>
                Settings
              </NavLink>
            </nav>
          </div>
          <div className="flex items-center gap-3 text-sm text-slate-600">
            <span>{mentor?.name ?? mentor?.email}</span>
            <button
              className="rounded-lg border border-slate-200 px-3 py-1.5 hover:bg-slate-50"
              onClick={() => {
                void api.logout().finally(() => setMentor(null));
              }}
            >
              Log out
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">
        <Outlet />
      </main>
    </div>
  );
}
