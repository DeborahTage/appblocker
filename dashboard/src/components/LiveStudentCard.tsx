import type { SessionResponse } from '@focusmentor/contracts';
import { useLiveStore } from '../stores/liveStore';
import { signalEmoji } from '../utils/format';
import { useSessionSocket } from '../hooks/useSessionSocket';

interface Props {
  session: SessionResponse;
  onEnd: (id: string) => void;
}

export function LiveStudentCard({ session, onEnd }: Props) {
  const live = useLiveStore((s) => s.bySession[session.id]);
  const socketStatus = useLiveStore((s) => s.socketBySession[session.id] ?? 'disconnected');
  useSessionSocket(session.id, session.status !== 'ended');

  const state = live?.state ?? session.live?.currentState ?? 'Waiting';
  const app = live?.currentApp ?? session.live?.currentApp ?? '—';
  const connected = live?.connected ?? session.live?.connected ?? false;
  const dataSource = live?.dataSource ?? session.live?.dataSource ?? 'none';
  const lastUpdated = live?.lastUpdated ?? session.live?.lastUpdated ?? null;

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-ink-900">{session.studentName}</h3>
          <p className="mt-1 text-sm text-slate-500">
            {signalEmoji(state)} {state.replace(/([A-Z])/g, ' $1').trim()}
          </p>
        </div>
        <span
          className={`rounded-full px-2.5 py-1 text-xs font-medium ${
            connected ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'
          }`}
        >
          {connected ? 'Signal' : 'No signal'}
        </span>
      </div>
      <div className="mt-3 flex items-center gap-2 text-xs">
        <span
          className={`rounded-full px-2.5 py-1 font-semibold ${
            dataSource === 'live'
              ? 'bg-emerald-50 text-emerald-700'
              : 'bg-amber-50 text-amber-700'
          }`}
        >
          {dataSource === 'live' ? '● LIVE DATA' : '○ WAITING FOR LIVE DATA'}
        </span>
        <span className="text-slate-500">Dashboard socket: {socketStatus}</span>
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <div>
          <dt className="text-slate-500">Current app</dt>
          <dd className="font-medium text-ink-900">{app}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Last real event</dt>
          <dd className="font-medium text-ink-900">
            {lastUpdated ? new Date(lastUpdated).toLocaleTimeString() : '—'}
          </dd>
        </div>
      </dl>
      {session.pairingCode && (
        <p className="mt-4 rounded-lg bg-accent-soft px-3 py-2 font-mono text-sm text-accent">
          Pairing: {session.pairingCode}
        </p>
      )}
      {session.status !== 'ended' && (
        <button
          className="mt-4 w-full rounded-lg border border-rose-200 px-3 py-2 text-sm font-medium text-rose-700 hover:bg-rose-50"
          onClick={() => onEnd(session.id)}
        >
          Disconnect / End session
        </button>
      )}
    </article>
  );
}
