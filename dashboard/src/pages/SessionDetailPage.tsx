import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api/client';
import { LiveStudentCard } from '../components/LiveStudentCard';
import { SummaryCharts } from '../components/SummaryCharts';

export function SessionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const session = useQuery({
    queryKey: ['session', id],
    queryFn: () => api.getSession(id!),
    enabled: Boolean(id),
    refetchInterval: 8_000,
  });

  const end = useMutation({
    mutationFn: () => api.endSession(id!),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['session', id] });
      void qc.invalidateQueries({ queryKey: ['sessions'] });
    },
  });

  if (session.isLoading) return <p>Loading…</p>;
  if (!session.data) return <p className="text-rose-600">Session not found</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link to="/sessions" className="text-sm text-accent hover:underline">
            ← Sessions
          </Link>
          <h1 className="mt-2 text-2xl font-semibold">{session.data.studentName}</h1>
          <p className="text-sm text-slate-500">Status: {session.data.status}</p>
        </div>
      </div>
      <LiveStudentCard session={session.data} onEnd={() => end.mutate()} />
      {session.data.summary && session.data.config.enableSessionSummary && (
        <div>
          <h2 className="mb-3 text-lg font-semibold">Session summary</h2>
          <SummaryCharts summary={session.data.summary} />
        </div>
      )}
      {!session.data.summary && session.data.status === 'ended' && (
        <p className="text-sm text-slate-500">
          No summary available (disabled for this session or retention expired).
        </p>
      )}
    </div>
  );
}
