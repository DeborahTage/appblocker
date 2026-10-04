import { describe, expect, it } from 'vitest';
import { applyStateChange, buildSummary } from './aggregation.js';
import type { LiveStudentRecord } from '../models/liveState.js';

function record(): LiveStudentRecord {
  return {
    studentId: 's1',
    studentName: 'Alex',
    sessionId: 'sess1',
    currentState: 'Waiting',
    currentApp: null,
    processName: null,
    lastUpdated: null,
    lastHeartbeatAt: null,
    connected: true,
    dataSource: 'live',
    joinedAt: new Date('2026-01-01T00:00:00Z'),
    segmentStartedAt: new Date('2026-01-01T00:00:00Z'),
    onTaskSeconds: 0,
    awaySeconds: 0,
    blockedSeconds: 0,
    appSeconds: new Map(),
  };
}

describe('aggregation', () => {
  it('aggregates on-task time by app without storing titles', () => {
    const r = record();
    applyStateChange(
      r,
      { state: 'OnTask', currentApp: 'VS Code', processName: 'Code.exe' },
      new Date('2026-01-01T00:00:00Z'),
    );
    applyStateChange(
      r,
      { state: 'BlockedAppDetected', currentApp: 'Discord', processName: 'Discord.exe' },
      new Date('2026-01-01T00:10:00Z'),
    );
    const summary = buildSummary(r, new Date('2026-01-01T00:12:00Z'));
    expect(summary.apps.find((a) => a.appName === 'VS Code')?.minutes).toBe(10);
    expect(summary.apps.find((a) => a.appName === 'Discord')?.minutes).toBe(2);
    expect(summary.onTaskPercent).toBeGreaterThan(0);
    expect(JSON.stringify(summary)).not.toMatch(/https?:\/\//);
  });
});
