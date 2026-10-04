import { useState } from 'react';
import { leaveSession } from '../hooks/useTauri';
import { statusColor, useAgentStore } from '../stores/agentStore';
import { DebugPage } from './DebugPage';

export function ActiveSessionPage() {
  const focusState = useAgentStore((s) => s.focusState);
  const currentApp = useAgentStore((s) => s.currentApp);
  const studentName = useAgentStore((s) => s.studentName);
  const websocketStatus = useAgentStore((s) => s.websocketStatus);
  const capability = useAgentStore((s) => s.capability);
  const [showDebug, setShowDebug] = useState(import.meta.env.DEV);

  return (
    <div className="stack">
      <div className="card stack">
        <div>
          <div className="indicator-row">
            <span className="live-indicator">● LIVE NATIVE DATA</span>
            <span className="muted">WebSocket: {websocketStatus}</span>
          </div>
          <h1>Lesson in progress</h1>
          <p className="muted">Hi {studentName ?? 'student'}. Only your active app name is shared.</p>
        </div>
        <div className={`status-pill ${statusColor(focusState)}`}>
          <span
            aria-hidden
            style={{
              width: 8,
              height: 8,
              borderRadius: 999,
              background: 'currentColor',
              display: 'inline-block',
            }}
          />
          {focusState}
        </div>
        <div>
          <div className="muted">Current app</div>
          <strong>{currentApp ?? 'Waiting for the first native sample…'}</strong>
        </div>
        <p className="muted">
          Detection: {capability.platform}/{capability.sessionType}. Window titles remain local and
          URLs are never read or sent.
        </p>
        {import.meta.env.DEV && (
          <button className="btn btn-secondary" onClick={() => setShowDebug((current) => !current)}>
            {showDebug ? 'Hide debug' : 'Show debug'}
          </button>
        )}
        <button className="btn btn-danger" onClick={() => void leaveSession()}>
          Leave session
        </button>
      </div>
      {showDebug && <DebugPage />}
    </div>
  );
}
