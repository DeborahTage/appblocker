import { useAgentStore } from '../stores/agentStore';

export function EndedPage() {
  const setFromStatus = useAgentStore((s) => s.setFromStatus);
  const consented = useAgentStore((s) => s.consented);
  const capability = useAgentStore((s) => s.capability);

  return (
    <div className="card stack">
      <h1>Session ended</h1>
      <p className="muted">
        Monitoring has stopped. No polling, websocket, or session data remains in memory.
      </p>
      <button
        className="btn btn-primary"
        onClick={() =>
          setFromStatus({
            consented,
            focusState: 'Disconnected',
            currentApp: null,
            processName: null,
            windowTitle: null,
            monitoring: false,
            studentName: null,
            sessionId: null,
            domainMatchingSupported: false,
            runtimeMode: 'native',
            capability,
            websocketStatus: 'disconnected',
            lastHeartbeatAt: null,
            lastError: null,
          })
        }
      >
        Back to pairing
      </button>
    </div>
  );
}
