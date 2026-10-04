import { useState, type FormEvent } from 'react';
import { joinWithCode } from '../hooks/useTauri';
import { useAgentStore } from '../stores/agentStore';

export function PairingPage() {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const error = useAgentStore((s) => s.error);
  const setError = useAgentStore((s) => s.setError);
  const runtimeMode = useAgentStore((s) => s.runtimeMode);
  const capability = useAgentStore((s) => s.capability);
  const canJoin = runtimeMode === 'native' && capability.supported;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await joinWithCode(code.trim().toUpperCase());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to join session');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="card stack" onSubmit={onSubmit}>
      <div>
        <h1>Join lesson</h1>
        <p className="muted">
          Enter the pairing code from your mentor. Monitoring starts only after a successful join
          and stops immediately when the session ends.
        </p>
      </div>
      {!canJoin && (
        <div className="unsupported-notice" role="alert">
          <strong>Live monitoring unavailable</strong>
          <p>
            {runtimeMode === 'browser'
              ? 'This is the React browser preview. It does not generate or send student activity. Launch the native Tauri Student Agent.'
              : capability.message}
          </p>
        </div>
      )}
      <label>
        Pairing code
        <input
          className="input"
          placeholder="ABCD-1234"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          pattern="[A-Za-z0-9]{4}-[A-Za-z0-9]{4}"
          required
        />
      </label>
      {error && <p className="error">{error}</p>}
      <button className="btn btn-primary" type="submit" disabled={loading || !canJoin}>
        {loading ? 'Joining…' : 'Join session'}
      </button>
    </form>
  );
}
