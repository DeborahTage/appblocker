import { useEffect, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';

function listFromText(value: string): string[] {
  return value
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);
}

export function CreateSessionPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const students = useQuery({
    queryKey: ['students'],
    queryFn: async () => (await api.listStudents()).students,
  });
  const settings = useQuery({
    queryKey: ['settings'],
    queryFn: async () => (await api.getSettings()).settings,
  });

  const [studentId, setStudentId] = useState('');
  const [duration, setDuration] = useState(60);
  const [allowedApps, setAllowedApps] = useState('');
  const [blockedApps, setBlockedApps] = useState('');
  const [enableSummary, setEnableSummary] = useState(false);
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (!settings.data || hydrated) return;
    setAllowedApps(settings.data.defaultAllowedApps.join('\n'));
    setBlockedApps(settings.data.defaultBlockedApps.join('\n'));
    setDuration(settings.data.defaultDurationMinutes);
    setEnableSummary(settings.data.enableSessionSummaryByDefault);
    setHydrated(true);
  }, [settings.data, hydrated]);

  const create = useMutation({
    mutationFn: () =>
      api.createSession({
        studentId,
        durationMinutes: duration,
        config: {
          allowedApps: listFromText(allowedApps),
          blockedApps: listFromText(blockedApps),
          enableSessionSummary: enableSummary,
        },
      }),
    onSuccess: (session) => {
      setPairingCode(session.pairingCode);
      void qc.invalidateQueries({ queryKey: ['sessions'] });
    },
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    create.mutate();
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-semibold">Create session</h1>
      <p className="mt-1 text-sm text-slate-500">
        Domain lists can be configured for future clients; Windows MVP does not match domains.
      </p>

      {pairingCode ? (
        <div className="mt-8 rounded-2xl border border-emerald-200 bg-emerald-50 p-6">
          <h2 className="text-lg font-semibold text-emerald-900">Pairing code</h2>
          <p className="mt-3 font-mono text-3xl tracking-widest text-emerald-800">{pairingCode}</p>
          <div className="mt-4 flex gap-3">
            <button
              className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white"
              onClick={async () => {
                await navigator.clipboard.writeText(pairingCode);
                setCopied(true);
              }}
            >
              {copied ? 'Copied' : 'Copy'}
            </button>
            <button
              className="rounded-lg border border-emerald-300 px-4 py-2 text-sm"
              onClick={() => navigate('/')}
            >
              Go to dashboard
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="mt-6 space-y-4 rounded-2xl border bg-white p-6">
          <label className="block text-sm font-medium">
            Student
            <select
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
              value={studentId}
              onChange={(e) => setStudentId(e.target.value)}
              required
            >
              <option value="">Select…</option>
              {(students.data ?? []).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm font-medium">
            Duration (minutes)
            <input
              type="number"
              min={5}
              max={480}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
            />
          </label>
          <label className="block text-sm font-medium">
            Allowed apps (one per line)
            <textarea
              className="mt-1 h-28 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm"
              value={allowedApps}
              onChange={(e) => setAllowedApps(e.target.value)}
            />
          </label>
          <label className="block text-sm font-medium">
            Blocked apps (one per line)
            <textarea
              className="mt-1 h-28 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm"
              value={blockedApps}
              onChange={(e) => setBlockedApps(e.target.value)}
            />
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={enableSummary}
              onChange={(e) => setEnableSummary(e.target.checked)}
            />
            Enable aggregate session summary (no URLs/titles)
          </label>
          <button
            type="submit"
            disabled={create.isPending}
            className="rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-white"
          >
            Generate pairing code
          </button>
          {create.isError && (
            <p className="text-sm text-rose-600">
              {(create.error as Error).message ?? 'Failed to create session'}
            </p>
          )}
        </form>
      )}
    </div>
  );
}
