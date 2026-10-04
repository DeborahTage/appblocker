import { describe, expect, it } from 'vitest';
import { buildSummary } from './aggregation.js';
import type { LiveStudentRecord } from '../models/liveState.js';

describe('session summary retention shape', () => {
  it('stores only aggregate app minutes — never URLs or titles', () => {
    const record: LiveStudentRecord = {
      studentId: 's',
      studentName: 'Alex',
      sessionId: 'sess',
      currentState: 'OnTask',
      currentApp: 'VS Code',
      processName: 'Code.exe',
      lastUpdated: new Date(),
      lastHeartbeatAt: new Date(),
      connected: true,
      dataSource: 'live',
      joinedAt: new Date(),
      segmentStartedAt: new Date(Date.now() - 60_000),
      onTaskSeconds: 0,
      awaySeconds: 0,
      blockedSeconds: 0,
      appSeconds: new Map([['VS Code', 2520]]),
    };
    const summary = buildSummary(record);
    expect(summary.apps[0]).toEqual({ appName: 'VS Code', minutes: 43 });
    const serialized = JSON.stringify(summary);
    expect(serialized).not.toMatch(/window/i);
    expect(serialized).not.toMatch(/http/i);
    expect(serialized).not.toMatch(/password/i);
  });
});
