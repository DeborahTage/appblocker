import { useAgentStore } from '../stores/agentStore';

function value(value: string | null | undefined): string {
  return value || '—';
}

export function DebugPage() {
  const telemetry = useAgentStore((state) => state.debugTelemetry);
  const capability = useAgentStore((state) => state.capability);
  const currentApp = useAgentStore((state) => state.currentApp);
  const processName = useAgentStore((state) => state.processName);
  const windowTitle = useAgentStore((state) => state.windowTitle);
  const focusState = useAgentStore((state) => state.focusState);
  const websocketStatus = useAgentStore((state) => state.websocketStatus);
  const lastHeartbeatAt = useAgentStore((state) => state.lastHeartbeatAt);

  return (
    <section className="card stack debug-card" aria-label="Native agent debug information">
      <div>
        <h2>Debug: live native data</h2>
        <p className="muted">
          Window title is shown locally for development only. It is never sent to the backend.
        </p>
      </div>

      <dl className="debug-grid">
        <div>
          <dt>Data source</dt>
          <dd>{capability.supported ? 'Live native detection' : 'Unavailable'}</dd>
        </div>
        <div>
          <dt>Environment</dt>
          <dd>
            {capability.platform} / {capability.sessionType}
          </dd>
        </div>
        <div>
          <dt>Foreground application</dt>
          <dd>{value(currentApp)}</dd>
        </div>
        <div>
          <dt>Process name</dt>
          <dd>{value(processName)}</dd>
        </div>
        <div className="debug-wide">
          <dt>Window title (local only)</dt>
          <dd>{value(windowTitle)}</dd>
        </div>
        <div>
          <dt>Current state</dt>
          <dd>{focusState}</dd>
        </div>
        <div>
          <dt>WebSocket</dt>
          <dd>{websocketStatus}</dd>
        </div>
        <div>
          <dt>Last heartbeat sent</dt>
          <dd>{lastHeartbeatAt ? new Date(lastHeartbeatAt).toLocaleTimeString() : '—'}</dd>
        </div>
        <div>
          <dt>Last state sent</dt>
          <dd>
            {telemetry?.lastStateSentAt
              ? new Date(telemetry.lastStateSentAt).toLocaleTimeString()
              : '—'}
          </dd>
        </div>
      </dl>

      {capability.message && <p className="notice">{capability.message}</p>}
      {telemetry?.lastError && <p className="error">{telemetry.lastError}</p>}

      <div>
        <h3>Recent native logs</h3>
        <div className="debug-log" role="log" aria-live="polite">
          {telemetry?.logs.length ? (
            [...telemetry.logs]
              .reverse()
              .map((entry) => (
                <div key={`${entry.timestamp}-${entry.message}`}>
                  <time>{new Date(entry.timestamp).toLocaleTimeString()}</time>{' '}
                  <strong>{entry.level.toUpperCase()}</strong> {entry.message}
                </div>
              ))
          ) : (
            <span>No native events yet.</span>
          )}
        </div>
      </div>
    </section>
  );
}
