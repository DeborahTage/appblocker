import type { PrismaClient, Session } from '@prisma/client';
import {
  SessionConfigSchema,
  type CreateSessionRequest,
  type FocusState,
  type JoinSessionResponse,
  type SessionConfig,
  type SessionResponse,
  type SessionSummary,
} from '@focusmentor/contracts';
import type { Env } from '../types/env.js';
import type { LiveStateStore } from '../models/liveState.js';
import { generatePairingCode, hashPairingCode } from '../utils/pairing.js';
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '../utils/errors.js';
import type { JwtService } from './jwtService.js';
import type { SettingsService } from './settingsService.js';
import { applyStateChange, buildSummary } from './aggregation.js';

function parseConfig(json: unknown): SessionConfig {
  return SessionConfigSchema.parse(json);
}

export class SessionService {
  constructor(
    private readonly db: PrismaClient,
    private readonly live: LiveStateStore,
    private readonly jwt: JwtService,
    private readonly settings: SettingsService,
    private readonly env: Env,
  ) {}

  async create(mentorId: string, input: CreateSessionRequest): Promise<SessionResponse> {
    const student = await this.db.student.findFirst({
      where: { id: input.studentId, mentorId },
    });
    if (!student) throw new NotFoundError('Student not found');

    const mentorSettings = await this.settings.getOrCreate(mentorId);
    const config = SessionConfigSchema.parse({
      allowedApps: input.config?.allowedApps ?? mentorSettings.defaultAllowedApps,
      blockedApps: input.config?.blockedApps ?? mentorSettings.defaultBlockedApps,
      allowedDomains: input.config?.allowedDomains ?? mentorSettings.defaultAllowedDomains,
      blockedDomains: input.config?.blockedDomains ?? mentorSettings.defaultBlockedDomains,
      enableSessionSummary:
        input.config?.enableSessionSummary ?? mentorSettings.enableSessionSummaryByDefault,
      summaryRetentionHours:
        input.config?.summaryRetentionHours ?? mentorSettings.summaryRetentionHours,
    });

    const pairingCode = generatePairingCode();
    const expiresAt = new Date(Date.now() + input.durationMinutes * 60_000);

    const session = await this.db.session.create({
      data: {
        mentorId,
        studentId: student.id,
        pairingCodeHash: hashPairingCode(pairingCode),
        pairingCodePlain: pairingCode,
        status: 'pending',
        expiresAt,
        configJson: config,
      },
      include: { student: true },
    });

    this.live.setConfig(session.id, config);
    this.live.set(session.id, {
      studentId: student.id,
      studentName: student.name,
      sessionId: session.id,
      currentState: 'Waiting',
      currentApp: null,
      processName: null,
      lastUpdated: null,
      lastHeartbeatAt: null,
      connected: false,
      dataSource: 'none',
      joinedAt: null,
      segmentStartedAt: null,
      onTaskSeconds: 0,
      awaySeconds: 0,
      blockedSeconds: 0,
      appSeconds: new Map(),
    });

    return this.toResponse(session, student.name, pairingCode);
  }

  async join(pairingCode: string): Promise<JoinSessionResponse> {
    const codeHash = hashPairingCode(pairingCode);
    const session = await this.db.session.findFirst({
      where: { pairingCodeHash: codeHash },
      include: { student: true },
    });

    if (!session) throw new NotFoundError('Invalid pairing code');
    if (session.status === 'ended') throw new ConflictError('Session has ended');
    if (session.expiresAt.getTime() <= Date.now()) {
      await this.end(session.id, session.mentorId, 'expired', true);
      throw new ConflictError('Session has expired');
    }
    if (session.pairingUsedAt) {
      throw new ConflictError('Pairing code already used');
    }

    const config = parseConfig(session.configJson);
    const updated = await this.db.session.update({
      where: { id: session.id },
      data: {
        pairingUsedAt: new Date(),
        pairingCodePlain: null,
        status: 'active',
      },
      include: { student: true },
    });

    this.live.setConfig(updated.id, config);
    const existing = this.live.get(updated.id);
    this.live.set(updated.id, {
      studentId: updated.studentId,
      studentName: updated.student.name,
      sessionId: updated.id,
      currentState: existing?.currentState ?? 'Waiting',
      currentApp: existing?.currentApp ?? null,
      processName: existing?.processName ?? null,
      lastUpdated: existing?.lastUpdated ?? null,
      lastHeartbeatAt: existing?.lastHeartbeatAt ?? null,
      connected: false,
      dataSource: existing?.dataSource ?? 'none',
      joinedAt: null,
      segmentStartedAt: existing?.segmentStartedAt ?? null,
      onTaskSeconds: existing?.onTaskSeconds ?? 0,
      awaySeconds: existing?.awaySeconds ?? 0,
      blockedSeconds: existing?.blockedSeconds ?? 0,
      appSeconds: existing?.appSeconds ?? new Map(),
    });

    const token = this.jwt.signStudent({
      sub: updated.studentId,
      sessionId: updated.id,
      studentId: updated.studentId,
    });

    return {
      token,
      sessionId: updated.id,
      expiresAt: updated.expiresAt.toISOString(),
      config,
      student: {
        id: updated.student.id,
        name: updated.student.name,
      },
      domainMatchingSupported: false,
    };
  }

  async getById(sessionId: string, mentorId?: string): Promise<SessionResponse> {
    const session = await this.db.session.findUnique({
      where: { id: sessionId },
      include: { student: true, summary: true },
    });
    if (!session) throw new NotFoundError('Session not found');
    if (mentorId && session.mentorId !== mentorId) {
      throw new ForbiddenError('Not your session');
    }

    const pairing =
      session.status === 'pending' && session.pairingCodePlain ? session.pairingCodePlain : null;
    const response = this.toResponse(session, session.student.name, pairing);

    if (session.summary && session.configJson) {
      const config = parseConfig(session.configJson);
      if (config.enableSessionSummary) {
        const apps = session.summary.appDurationsJson as Array<{
          appName: string;
          seconds: number;
        }>;
        const total =
          session.summary.onTaskSeconds +
          session.summary.awaySeconds +
          session.summary.blockedSeconds;
        const pct = (s: number) => (total === 0 ? 0 : Math.round((s / total) * 100));
        response.summary = {
          onTaskPercent: pct(session.summary.onTaskSeconds),
          awayPercent: pct(session.summary.awaySeconds),
          blockedPercent: pct(session.summary.blockedSeconds),
          apps: apps.map((a) => ({
            appName: a.appName,
            minutes: Math.round((a.seconds / 60) * 10) / 10,
          })),
        };
      }
    }

    return response;
  }

  async listForMentor(mentorId: string): Promise<SessionResponse[]> {
    const sessions = await this.db.session.findMany({
      where: { mentorId },
      include: { student: true },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return sessions.map((s) =>
      this.toResponse(
        s,
        s.student.name,
        s.status === 'pending' && s.pairingCodePlain ? s.pairingCodePlain : null,
      ),
    );
  }

  async end(
    sessionId: string,
    mentorId: string | null,
    _reason: 'mentor_ended' | 'expired' | 'student_left' | 'error' = 'mentor_ended',
    system = false,
  ): Promise<SessionResponse> {
    const session = await this.db.session.findUnique({
      where: { id: sessionId },
      include: { student: true },
    });
    if (!session) throw new NotFoundError('Session not found');
    if (!system && mentorId && session.mentorId !== mentorId) {
      throw new ForbiddenError('Not your session');
    }
    if (session.status === 'ended') {
      return this.toResponse(session, session.student.name, null);
    }

    const config = parseConfig(session.configJson);
    const live = this.live.get(sessionId);
    let summaryDto: SessionSummary | null = null;

    if (live && config.enableSessionSummary) {
      summaryDto = buildSummary(live);
      const retainUntil = new Date(Date.now() + config.summaryRetentionHours * 60 * 60 * 1000);
      await this.db.sessionSummary.upsert({
        where: { sessionId },
        create: {
          sessionId,
          onTaskSeconds: live.onTaskSeconds,
          awaySeconds: live.awaySeconds,
          blockedSeconds: live.blockedSeconds,
          appDurationsJson: [...live.appSeconds.entries()].map(([appName, seconds]) => ({
            appName,
            seconds,
          })),
          retainUntil,
        },
        update: {
          onTaskSeconds: live.onTaskSeconds,
          awaySeconds: live.awaySeconds,
          blockedSeconds: live.blockedSeconds,
          appDurationsJson: [...live.appSeconds.entries()].map(([appName, seconds]) => ({
            appName,
            seconds,
          })),
          retainUntil,
        },
      });
    }

    const updated = await this.db.session.update({
      where: { id: sessionId },
      data: {
        status: 'ended',
        endedAt: new Date(),
        pairingCodePlain: null,
        pairingCodeHash: null,
      },
      include: { student: true },
    });

    this.live.clearSession(sessionId);
    const response = this.toResponse(updated, updated.student.name, null);
    response.summary = summaryDto;
    return response;
  }

  async assertStudentSessionActive(sessionId: string, studentId: string): Promise<Session> {
    const session = await this.db.session.findUnique({ where: { id: sessionId } });
    if (!session || session.studentId !== studentId) {
      throw new ForbiddenError('Invalid session credentials');
    }
    if (session.status === 'ended') {
      throw new ForbiddenError('Session ended');
    }
    if (session.expiresAt.getTime() <= Date.now()) {
      await this.end(sessionId, session.mentorId, 'expired', true);
      throw new ForbiddenError('Session expired');
    }
    return session;
  }

  markConnected(sessionId: string): void {
    const live = this.live.get(sessionId);
    if (!live) return;
    live.connected = true;
    live.joinedAt = live.joinedAt ?? new Date();
    live.segmentStartedAt = live.segmentStartedAt ?? new Date();
    if (live.currentState === 'Waiting' || live.currentState === 'Disconnected') {
      live.currentState = 'Waiting';
    }
    this.live.set(sessionId, live);
  }

  markDisconnected(sessionId: string): void {
    const live = this.live.get(sessionId);
    if (!live) return;
    applyStateChange(live, {
      state: 'Disconnected',
      currentApp: live.currentApp,
      processName: live.processName,
    });
    live.connected = false;
    this.live.set(sessionId, live);
  }

  updateStudentState(
    sessionId: string,
    next: {
      state: FocusState;
      currentApp: string | null;
      processName: string | null;
    },
  ) {
    const live = this.live.get(sessionId);
    if (!live) return null;
    // Reject forbidden fields by construction — only app display name + process basename.
    applyStateChange(live, {
      state: next.state,
      currentApp: next.currentApp,
      processName: next.processName,
    });
    live.connected = true;
    live.dataSource = 'live';
    this.live.set(sessionId, live);
    return live;
  }

  recordHeartbeat(sessionId: string): void {
    const live = this.live.get(sessionId);
    if (!live) return;
    live.lastHeartbeatAt = new Date();
    live.connected = true;
    this.live.set(sessionId, live);
  }

  getLive(sessionId: string) {
    return this.live.get(sessionId);
  }

  getConfig(sessionId: string) {
    return this.live.getConfig(sessionId) ?? null;
  }

  async updateConfig(
    sessionId: string,
    mentorId: string,
    patch: Partial<SessionConfig>,
  ): Promise<SessionConfig> {
    const session = await this.db.session.findUnique({ where: { id: sessionId } });
    if (!session) throw new NotFoundError('Session not found');
    if (session.mentorId !== mentorId) throw new ForbiddenError('Not your session');
    if (session.status === 'ended') throw new ConflictError('Session ended');

    const current = parseConfig(session.configJson);
    const next = SessionConfigSchema.parse({ ...current, ...patch });
    await this.db.session.update({
      where: { id: sessionId },
      data: { configJson: next },
    });
    this.live.setConfig(sessionId, next);
    return next;
  }

  async cleanupExpiredSummaries(): Promise<number> {
    const result = await this.db.sessionSummary.deleteMany({
      where: { retainUntil: { lt: new Date() } },
    });
    return result.count;
  }

  async expireStaleSessions(): Promise<number> {
    const stale = await this.db.session.findMany({
      where: {
        status: { in: ['pending', 'active'] },
        expiresAt: { lt: new Date() },
      },
      select: { id: true, mentorId: true },
    });
    for (const s of stale) {
      await this.end(s.id, s.mentorId, 'expired', true);
    }
    return stale.length;
  }

  private toResponse(
    session: Session & { student?: { name: string } },
    studentName: string,
    pairingCode: string | null,
  ): SessionResponse {
    const config = parseConfig(session.configJson);
    const live = this.live.get(session.id);
    const now = Date.now();
    const elapsedSeconds = live?.joinedAt
      ? Math.max(0, Math.floor((now - live.joinedAt.getTime()) / 1000))
      : 0;

    return {
      id: session.id,
      mentorId: session.mentorId,
      studentId: session.studentId,
      studentName,
      pairingCode,
      status: session.status,
      expiresAt: session.expiresAt.toISOString(),
      createdAt: session.createdAt.toISOString(),
      endedAt: session.endedAt?.toISOString() ?? null,
      config,
      live: live
        ? {
            studentId: live.studentId,
            studentName: live.studentName,
            currentState: live.currentState,
            currentApp: live.currentApp,
            processName: live.processName,
            lastUpdated: live.lastUpdated?.toISOString() ?? null,
            connected: live.connected,
            dataSource: live.dataSource,
            elapsedSeconds,
          }
        : null,
      summary: null,
    };
  }

  validateStatePayload(input: { currentApp: string | null; processName: string | null }): void {
    // Privacy guard: reject values that look like URLs or absolute paths.
    const suspicious = [input.currentApp, input.processName].filter(Boolean) as string[];
    for (const value of suspicious) {
      if (/https?:\/\//i.test(value) || value.includes('://')) {
        throw new ValidationError('URLs are not permitted in state payloads');
      }
      if (/^[A-Za-z]:\\/.test(value) || value.startsWith('/')) {
        throw new ValidationError('File paths are not permitted in state payloads');
      }
    }
  }
}
