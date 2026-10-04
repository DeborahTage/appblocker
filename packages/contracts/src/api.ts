import { z } from 'zod';
import { SessionConfigSchema } from './config.js';
import { FocusStateSchema } from './states.js';

export const LoginRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
});

export const LoginResponseSchema = z.object({
  mentor: z.object({
    id: z.string().uuid(),
    email: z.string().email(),
    name: z.string(),
  }),
});

export const CreateStudentRequestSchema = z.object({
  name: z.string().min(1).max(120),
  email: z.string().email().optional(),
});

export const CreateSessionRequestSchema = z.object({
  studentId: z.string().uuid(),
  durationMinutes: z.number().int().min(5).max(480),
  config: SessionConfigSchema.partial().optional(),
});

export const JoinSessionRequestSchema = z.object({
  pairingCode: z
    .string()
    .trim()
    .regex(/^[A-Z0-9]{4}-[A-Z0-9]{4}$/i, 'Pairing code must look like ABCD-1234')
    .transform((v) => v.toUpperCase()),
});

export const JoinSessionResponseSchema = z.object({
  token: z.string(),
  sessionId: z.string().uuid(),
  expiresAt: z.string().datetime(),
  config: SessionConfigSchema,
  student: z.object({
    id: z.string().uuid(),
    name: z.string(),
  }),
  /** Domain matching is unsupported on the Windows MVP agent. */
  domainMatchingSupported: z.literal(false),
});

export const SessionSummaryBucketSchema = z.object({
  appName: z.string(),
  minutes: z.number().nonnegative(),
});

export const SessionSummarySchema = z.object({
  onTaskPercent: z.number().min(0).max(100),
  awayPercent: z.number().min(0).max(100),
  blockedPercent: z.number().min(0).max(100),
  apps: z.array(SessionSummaryBucketSchema),
});

export const LiveStudentStateSchema = z.object({
  studentId: z.string().uuid(),
  studentName: z.string(),
  currentState: FocusStateSchema,
  currentApp: z.string().nullable(),
  processName: z.string().nullable(),
  lastUpdated: z.string().datetime().nullable(),
  connected: z.boolean(),
  dataSource: z.enum(['live', 'none']),
  elapsedSeconds: z.number().int().nonnegative(),
});

export const SessionResponseSchema = z.object({
  id: z.string().uuid(),
  mentorId: z.string().uuid(),
  studentId: z.string().uuid(),
  studentName: z.string(),
  pairingCode: z.string().nullable(),
  status: z.enum(['pending', 'active', 'ended']),
  expiresAt: z.string().datetime(),
  createdAt: z.string().datetime(),
  endedAt: z.string().datetime().nullable(),
  config: SessionConfigSchema,
  live: LiveStudentStateSchema.nullable(),
  summary: SessionSummarySchema.nullable(),
});

export const MentorSettingsSchema = z.object({
  defaultAllowedApps: z.array(z.string()),
  defaultBlockedApps: z.array(z.string()),
  defaultAllowedDomains: z.array(z.string()),
  defaultBlockedDomains: z.array(z.string()),
  defaultDurationMinutes: z.number().int().min(5).max(480),
  enableSessionSummaryByDefault: z.boolean(),
  summaryRetentionHours: z.number().int().positive().max(168),
});

export type LoginRequest = z.infer<typeof LoginRequestSchema>;
export type CreateSessionRequest = z.infer<typeof CreateSessionRequestSchema>;
export type JoinSessionRequest = z.infer<typeof JoinSessionRequestSchema>;
export type JoinSessionResponse = z.infer<typeof JoinSessionResponseSchema>;
export type SessionResponse = z.infer<typeof SessionResponseSchema>;
export type MentorSettings = z.infer<typeof MentorSettingsSchema>;
export type SessionSummary = z.infer<typeof SessionSummarySchema>;
export type LiveStudentState = z.infer<typeof LiveStudentStateSchema>;
