import type { FocusState, SessionSummary } from '@focusmentor/contracts';
import type { LiveStudentRecord } from '../models/liveState.js';

export function closeCurrentSegment(record: LiveStudentRecord, now = new Date()): void {
  if (!record.segmentStartedAt) return;
  const elapsed = Math.max(
    0,
    Math.floor((now.getTime() - record.segmentStartedAt.getTime()) / 1000),
  );
  if (elapsed === 0) {
    record.segmentStartedAt = now;
    return;
  }

  switch (record.currentState) {
    case 'OnTask':
      record.onTaskSeconds += elapsed;
      break;
    case 'Away':
      record.awaySeconds += elapsed;
      break;
    case 'BlockedAppDetected':
      record.blockedSeconds += elapsed;
      break;
    default:
      break;
  }

  if (
    record.currentApp &&
    (record.currentState === 'OnTask' ||
      record.currentState === 'BlockedAppDetected' ||
      record.currentState === 'Away')
  ) {
    const prev = record.appSeconds.get(record.currentApp) ?? 0;
    record.appSeconds.set(record.currentApp, prev + elapsed);
  }

  record.segmentStartedAt = now;
}

export function applyStateChange(
  record: LiveStudentRecord,
  next: {
    state: FocusState;
    currentApp: string | null;
    processName: string | null;
  },
  now = new Date(),
): void {
  closeCurrentSegment(record, now);
  record.currentState = next.state;
  record.currentApp = next.currentApp;
  record.processName = next.processName;
  record.lastUpdated = now;
  record.segmentStartedAt = now;
}

export function buildSummary(record: LiveStudentRecord, now = new Date()): SessionSummary {
  closeCurrentSegment(record, now);
  const total = record.onTaskSeconds + record.awaySeconds + record.blockedSeconds;
  const pct = (seconds: number) => (total === 0 ? 0 : Math.round((seconds / total) * 100));

  const apps = [...record.appSeconds.entries()]
    .map(([appName, seconds]) => ({
      appName,
      minutes: Math.round((seconds / 60) * 10) / 10,
    }))
    .filter((a) => a.minutes > 0)
    .sort((a, b) => b.minutes - a.minutes);

  return {
    onTaskPercent: pct(record.onTaskSeconds),
    awayPercent: pct(record.awaySeconds),
    blockedPercent: pct(record.blockedSeconds),
    apps,
  };
}
