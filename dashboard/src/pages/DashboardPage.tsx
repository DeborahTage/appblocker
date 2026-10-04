import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { LiveStudentCard } from '../components/LiveStudentCard';

export function DashboardPage() {
  const qc = useQueryClient();
  const sessions = useQuery({
    queryKey: ['sessions'],
    queryFn: async () => (await api.listSessions()).sessions,
    refetchInterval: 10_000,
  });

  const endMutation = useMutation({
    mutationFn: (id: string) => api.endSession(id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['sessions'] }),
  });

  const live = (sessions.data ?? []).filter((s) => s.status !== 'ended');

  return (
    <div>
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-ink-900">Live lessons</h1>
          <p className="mt-1 text-sm text-slate-500">
            Only app focus state is shown — never screens, keystrokes, or code.
          </p>
        </div>
        <Link
          to="/sessions/new"
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          New session
        </Link>
      </div>

      {sessions.isLoading && <p className="mt-8 text-slate-500">Loading sessions…</p>}
      {sessions.isError && (
        <p className="mt-8 text-rose-600">Failed to load sessions. Are you signed in?</p>
      )}
      {!sessions.isLoading && live.length === 0 && (
        <div className="mt-8 rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500">
          No active sessions. Create one to generate a pairing code.
        </div>
      )}
      <div className="mt-8 grid gap-4 md:grid-cols-2">
        {live.map((session) => (
          <LiveStudentCard
            key={session.id}
            session={session}
            onEnd={(id) => endMutation.mutate(id)}
          />
        ))}
      </div>
    </div>
  );
}
