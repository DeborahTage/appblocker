import { describe, expect, it } from 'vitest';
import { StateChangeEventSchema } from './events.js';
import { SessionSummarySchema } from './api.js';

describe('contract privacy boundaries', () => {
  it('state_change accepts app name fields only', () => {
    const parsed = StateChangeEventSchema.parse({
      type: 'state_change',
      state: 'OnTask',
      currentApp: 'VS Code',
      processName: 'Code.exe',
      timestamp: new Date().toISOString(),
    });
    expect(parsed).not.toHaveProperty('windowTitle');
    expect(parsed).not.toHaveProperty('url');
  });

  it('summary schema is aggregate-only', () => {
    const summary = SessionSummarySchema.parse({
      onTaskPercent: 82,
      awayPercent: 12,
      blockedPercent: 6,
      apps: [{ appName: 'VS Code', minutes: 42 }],
    });
    expect(Object.keys(summary).sort()).toEqual([
      'apps',
      'awayPercent',
      'blockedPercent',
      'onTaskPercent',
    ]);
  });
});
