import { useState } from 'react';
import { agreeConsent } from '../hooks/useTauri';

export function ConsentPage() {
  const [loading, setLoading] = useState(false);

  return (
    <div className="card">
      <h1>Consent before monitoring</h1>
      <p className="muted">
        This application only monitors which application is currently active during an active
        lesson.
      </p>
      <p className="muted">It does NOT:</p>
      <ul className="privacy">
        <li>record your screen</li>
        <li>record your keyboard</li>
        <li>read your files</li>
        <li>capture passwords</li>
        <li>monitor you outside lesson sessions</li>
      </ul>
      <p className="muted">Monitoring only occurs while connected to an active lesson session.</p>
      <button
        className="btn btn-primary"
        disabled={loading}
        onClick={() => {
          setLoading(true);
          void agreeConsent().finally(() => setLoading(false));
        }}
      >
        I Agree
      </button>
    </div>
  );
}
