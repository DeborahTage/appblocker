import { useEffect, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';

function toLines(values: string[]): string {
  return values.join('\n');
}

function fromLines(value: string): string[] {
  return value
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);
}

export function SettingsPage() {
  const qc = useQueryClient();
  const settings = useQuery({
    queryKey: ['settings'],
    queryFn: async () => (await api.getSettings()).settings,
  });

  const [allowedApps, setAllowedApps] = useState('');
  const [blockedApps, setBlockedApps] = useState('');
  const [allowedDomains, setAllowedDomains] = useState('');
  const [blockedDomains, setBlockedDomains] = useState('');
  const [duration, setDuration] = useState(60);
  const [summary, setSummary] = useState(false);
  const [retention, setRetention] = useState(24);

  useEffect(() => {
    if (!settings.data) return;
    setAllowedApps(toLines(settings.data.defaultAllowedApps));
    setBlockedApps(toLines(settings.data.defaultBlockedApps));
    setAllowedDomains(toLines(settings.data.defaultAllowedDomains));
    setBlockedDomains(toLines(settings.data.defaultBlockedDomains));
    setDuration(settings.data.defaultDurationMinutes);
    setSummary(settings.data.enableSessionSummaryByDefault);
    setRetention(settings.data.summaryRetentionHours);
  }, [settings.data]);

  const save = useMutation({
    mutationFn: () =>
      api.updateSettings({
        defaultAllowedApps: fromLines(allowedApps),
        defaultBlockedApps: fromLines(blockedApps),
        defaultAllowedDomains: fromLines(allowedDomains),
        defaultBlockedDomains: fromLines(blockedDomains),
        defaultDurationMinutes: duration,
        enableSessionSummaryByDefault: summary,
        summaryRetentionHours: retention,
      }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['settings'] }),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    save.mutate();
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-semibold">Settings</h1>
      <p className="mt-1 text-sm text-slate-500">
        Defaults for new sessions. Domain matching is unsupported on the Windows student agent.
      </p>
      <form onSubmit={onSubmit} className="mt-6 space-y-4 rounded-2xl border bg-white p-6">
        <label className="block text-sm font-medium">
          Default allow list
          <textarea
            className="mt-1 h-28 w-full rounded-lg border px-3 py-2 font-mono text-sm"
            value={allowedApps}
            onChange={(e) => setAllowedApps(e.target.value)}
          />
        </label>
        <label className="block text-sm font-medium">
          Default block list
          <textarea
            className="mt-1 h-28 w-full rounded-lg border px-3 py-2 font-mono text-sm"
            value={blockedApps}
            onChange={(e) => setBlockedApps(e.target.value)}
          />
        </label>
        <label className="block text-sm font-medium">
          Default allowed domains (future)
          <textarea
            className="mt-1 h-20 w-full rounded-lg border px-3 py-2 font-mono text-sm"
            value={allowedDomains}
            onChange={(e) => setAllowedDomains(e.target.value)}
          />
        </label>
        <label className="block text-sm font-medium">
          Default blocked domains (future)
          <textarea
            className="mt-1 h-20 w-full rounded-lg border px-3 py-2 font-mono text-sm"
            value={blockedDomains}
            onChange={(e) => setBlockedDomains(e.target.value)}
          />
        </label>
        <label className="block text-sm font-medium">
          Default duration (minutes)
          <input
            type="number"
            className="mt-1 w-full rounded-lg border px-3 py-2"
            value={duration}
            onChange={(e) => setDuration(Number(e.target.value))}
          />
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={summary} onChange={(e) => setSummary(e.target.checked)} />
          Enable session summary by default
        </label>
        <label className="block text-sm font-medium">
          Summary retention (hours)
          <input
            type="number"
            className="mt-1 w-full rounded-lg border px-3 py-2"
            value={retention}
            onChange={(e) => setRetention(Number(e.target.value))}
          />
        </label>
        <button
          type="submit"
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white"
        >
          Save settings
        </button>
        {save.isSuccess && <p className="text-sm text-emerald-600">Saved.</p>}
      </form>
    </div>
  );
}
