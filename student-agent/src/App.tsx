import { ConsentPage } from './pages/ConsentPage';
import { PairingPage } from './pages/PairingPage';
import { ActiveSessionPage } from './pages/ActiveSessionPage';
import { EndedPage } from './pages/EndedPage';
import { useAgentBootstrap } from './hooks/useTauri';
import { useAgentStore } from './stores/agentStore';

export function App() {
  useAgentBootstrap();
  const consented = useAgentStore((s) => s.consented);
  const monitoring = useAgentStore((s) => s.monitoring);
  const focusState = useAgentStore((s) => s.focusState);
  const runtimeMode = useAgentStore((s) => s.runtimeMode);
  const capability = useAgentStore((s) => s.capability);

  let page = <PairingPage />;
  if (!consented) page = <ConsentPage />;
  else if (monitoring) page = <ActiveSessionPage />;
  else if (focusState === 'SessionEnded') page = <EndedPage />;

  return (
    <div className="app">
      <header style={{ marginBottom: 16 }}>
        <strong>FocusMentor</strong>
        <div className="muted">Student agent · privacy first</div>
        <div
          className={`runtime-indicator ${
            runtimeMode === 'native' && capability.supported
              ? 'runtime-live'
              : 'runtime-unavailable'
          }`}
        >
          {runtimeMode === 'native' && capability.supported
            ? '● Native live detection'
            : '○ No live data'}
        </div>
      </header>
      {page}
    </div>
  );
}
