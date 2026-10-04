import { z } from 'zod';
import { FocusStateSchema } from './states.js';
import { SessionConfigSchema } from './config.js';

export const WsClientRoleSchema = z.enum(['student', 'mentor']);
export type WsClientRole = z.infer<typeof WsClientRoleSchema>;

/** Client → server */
export const JoinSessionEventSchema = z.object({
  type: z.literal('join_session'),
  sessionId: z.string().uuid(),
  token: z.string().min(1),
  clientType: z.enum(['native_student_agent', 'mentor_dashboard']),
});

export const StateChangeEventSchema = z.object({
  type: z.literal('state_change'),
  state: FocusStateSchema,
  /** Normalized display name only (e.g. "VS Code"). Never a window title or URL. */
  currentApp: z.string().max(128).nullable(),
  /** Executable basename for allow/block matching (e.g. "Code.exe"). */
  processName: z.string().max(128).nullable(),
  timestamp: z.string().datetime(),
});

export const HeartbeatEventSchema = z.object({
  type: z.literal('heartbeat'),
  timestamp: z.string().datetime(),
});

export const LeaveSessionEventSchema = z.object({
  type: z.literal('leave_session'),
});

export const ClientToServerEventSchema = z.discriminatedUnion('type', [
  JoinSessionEventSchema,
  StateChangeEventSchema,
  HeartbeatEventSchema,
  LeaveSessionEventSchema,
]);

export type ClientToServerEvent = z.infer<typeof ClientToServerEventSchema>;

/** Server → client */
export const ConfigUpdateEventSchema = z.object({
  type: z.literal('config_update'),
  config: SessionConfigSchema,
});

export const SessionEndEventSchema = z.object({
  type: z.literal('session_end'),
  reason: z.enum(['mentor_ended', 'expired', 'student_left', 'error']),
});

export const StudentConnectedEventSchema = z.object({
  type: z.literal('student_connected'),
  studentId: z.string().uuid(),
  studentName: z.string(),
});

export const StudentDisconnectedEventSchema = z.object({
  type: z.literal('student_disconnected'),
  studentId: z.string().uuid(),
});

export const StudentStateUpdateEventSchema = z.object({
  type: z.literal('student_state'),
  studentId: z.string().uuid(),
  studentName: z.string(),
  state: FocusStateSchema,
  currentApp: z.string().nullable(),
  processName: z.string().nullable(),
  lastUpdated: z.string().datetime(),
  connected: z.boolean(),
  /** `live` only after a validated native student state_change reached the backend. */
  dataSource: z.enum(['live', 'none']),
});

export const JoinAckEventSchema = z.object({
  type: z.literal('join_ack'),
  sessionId: z.string().uuid(),
  role: WsClientRoleSchema,
  expiresAt: z.string().datetime(),
  config: SessionConfigSchema.optional(),
});

export const ErrorEventSchema = z.object({
  type: z.literal('error'),
  code: z.string(),
  message: z.string(),
});

export const ServerToClientEventSchema = z.discriminatedUnion('type', [
  ConfigUpdateEventSchema,
  SessionEndEventSchema,
  StudentConnectedEventSchema,
  StudentDisconnectedEventSchema,
  StudentStateUpdateEventSchema,
  JoinAckEventSchema,
  ErrorEventSchema,
]);

export type ServerToClientEvent = z.infer<typeof ServerToClientEventSchema>;
