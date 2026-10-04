import type { FocusState, SessionConfig } from '@focusmentor/contracts';

/**
 * In-memory live student state. Redis-ready: implement LiveStateStore
 * with a Redis adapter later without changing service call sites.
 */
export interface LiveStudentRecord {
  studentId: string;
  studentName: string;
  sessionId: string;
  currentState: FocusState;
  currentApp: string | null;
  processName: string | null;
  lastUpdated: Date | null;
  lastHeartbeatAt: Date | null;
  connected: boolean;
  /** `live` only after a validated native state_change event is received. */
  dataSource: 'live' | 'none';
  joinedAt: Date | null;
  /** Aggregation helpers — never persisted as raw event history */
  segmentStartedAt: Date | null;
  onTaskSeconds: number;
  awaySeconds: number;
  blockedSeconds: number;
  appSeconds: Map<string, number>;
}

export interface LiveStateStore {
  get(sessionId: string): LiveStudentRecord | undefined;
  set(sessionId: string, record: LiveStudentRecord): void;
  delete(sessionId: string): void;
  getConfig(sessionId: string): SessionConfig | undefined;
  setConfig(sessionId: string, config: SessionConfig): void;
  deleteConfig(sessionId: string): void;
  clearSession(sessionId: string): void;
}

export class InMemoryLiveStateStore implements LiveStateStore {
  private readonly students = new Map<string, LiveStudentRecord>();
  private readonly configs = new Map<string, SessionConfig>();

  get(sessionId: string): LiveStudentRecord | undefined {
    return this.students.get(sessionId);
  }

  set(sessionId: string, record: LiveStudentRecord): void {
    this.students.set(sessionId, record);
  }

  delete(sessionId: string): void {
    this.students.delete(sessionId);
  }

  getConfig(sessionId: string): SessionConfig | undefined {
    return this.configs.get(sessionId);
  }

  setConfig(sessionId: string, config: SessionConfig): void {
    this.configs.set(sessionId, config);
  }

  deleteConfig(sessionId: string): void {
    this.configs.delete(sessionId);
  }

  clearSession(sessionId: string): void {
    this.students.delete(sessionId);
    this.configs.delete(sessionId);
  }
}
