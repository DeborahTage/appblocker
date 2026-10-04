import type { IncomingMessage, Server as HttpServer } from 'node:http';
import { WebSocketServer, type WebSocket } from 'ws';
import {
  ClientToServerEventSchema,
  type ServerToClientEvent,
  type SessionConfig,
} from '@focusmentor/contracts';
import type { JwtService } from '../services/jwtService.js';
import type { SessionService } from '../services/sessionService.js';
import { logger } from '../utils/logger.js';
import { SessionHub, type HubClient } from './hub.js';

export function attachWebSocketServer(
  server: HttpServer,
  deps: {
    jwt: JwtService;
    sessions: SessionService;
    hub?: SessionHub;
  },
) {
  const hub = deps.hub ?? new SessionHub();
  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws: WebSocket, _req: IncomingMessage) => {
    let client: HubClient | null = null;

    ws.on('message', (data) => {
      void (async () => {
        try {
          const parsed = ClientToServerEventSchema.parse(JSON.parse(String(data)));

          if (parsed.type === 'join_session') {
            const payload = deps.jwt.verify(parsed.token);

            if (payload.role === 'student') {
              if (parsed.clientType !== 'native_student_agent') {
                send(ws, {
                  type: 'error',
                  code: 'NATIVE_AGENT_REQUIRED',
                  message: 'Student telemetry must come from the native Student Agent',
                });
                ws.close();
                return;
              }
              if (payload.sessionId !== parsed.sessionId) {
                send(ws, {
                  type: 'error',
                  code: 'FORBIDDEN',
                  message: 'Session mismatch',
                });
                ws.close();
                return;
              }
              const session = await deps.sessions.assertStudentSessionActive(
                payload.sessionId,
                payload.studentId,
              );
              client = {
                ws,
                role: 'student',
                sessionId: session.id,
                studentId: payload.studentId,
              };
              hub.add(client);
              deps.sessions.markConnected(session.id);
              logger.info(
                { sessionId: session.id, studentId: payload.studentId },
                'Native Student Agent joined WebSocket session',
              );
              const live = deps.sessions.getLive(session.id);
              const config = deps.sessions.getConfig(session.id);
              hub.send(client, {
                type: 'join_ack',
                sessionId: session.id,
                role: 'student',
                expiresAt: session.expiresAt.toISOString(),
                config: config ?? undefined,
              });
              hub.broadcast(
                session.id,
                {
                  type: 'student_connected',
                  studentId: payload.studentId,
                  studentName: live?.studentName ?? 'Student',
                },
                (c) => c.role === 'mentor',
              );
              if (live) {
                hub.broadcast(
                  session.id,
                  {
                    type: 'student_state',
                    studentId: live.studentId,
                    studentName: live.studentName,
                    state: live.currentState,
                    currentApp: live.currentApp,
                    processName: live.processName,
                    lastUpdated: live.lastUpdated?.toISOString() ?? new Date().toISOString(),
                    connected: true,
                    dataSource: live.dataSource,
                  },
                  (c) => c.role === 'mentor',
                );
              }
              return;
            }

            if (payload.role === 'ws_ticket' || payload.role === 'mentor') {
              if (parsed.clientType !== 'mentor_dashboard') {
                send(ws, {
                  type: 'error',
                  code: 'INVALID_CLIENT_TYPE',
                  message: 'Mentor connection must identify as the dashboard',
                });
                ws.close();
                return;
              }
              const mentorId = payload.role === 'mentor' ? payload.sub : payload.mentorId;
              const session = await deps.sessions.getById(parsed.sessionId, mentorId);
              client = {
                ws,
                role: 'mentor',
                sessionId: parsed.sessionId,
                mentorId,
              };
              hub.add(client);
              hub.send(client, {
                type: 'join_ack',
                sessionId: parsed.sessionId,
                role: 'mentor',
                expiresAt: session.expiresAt,
              });
              const live = deps.sessions.getLive(parsed.sessionId);
              if (live) {
                hub.send(client, {
                  type: 'student_state',
                  studentId: live.studentId,
                  studentName: live.studentName,
                  state: live.currentState,
                  currentApp: live.currentApp,
                  processName: live.processName,
                  lastUpdated: live.lastUpdated?.toISOString() ?? new Date().toISOString(),
                  connected: live.connected,
                  dataSource: live.dataSource,
                });
              }
              return;
            }

            send(ws, { type: 'error', code: 'FORBIDDEN', message: 'Invalid role' });
            ws.close();
            return;
          }

          if (!client) {
            send(ws, { type: 'error', code: 'UNAUTHORIZED', message: 'Join first' });
            return;
          }

          if (parsed.type === 'state_change') {
            if (client.role !== 'student') return;
            await deps.sessions.assertStudentSessionActive(client.sessionId, client.studentId!);
            deps.sessions.validateStatePayload({
              currentApp: parsed.currentApp,
              processName: parsed.processName,
            });
            const live = deps.sessions.updateStudentState(client.sessionId, {
              state: parsed.state,
              currentApp: parsed.currentApp,
              processName: parsed.processName,
            });
            logger.info(
              {
                sessionId: client.sessionId,
                studentId: client.studentId,
                state: parsed.state,
                currentApp: parsed.currentApp,
                processName: parsed.processName,
              },
              'Received native Student Agent state_change',
            );
            if (live) {
              hub.broadcast(
                client.sessionId,
                {
                  type: 'student_state',
                  studentId: live.studentId,
                  studentName: live.studentName,
                  state: live.currentState,
                  currentApp: live.currentApp,
                  processName: live.processName,
                  lastUpdated: live.lastUpdated?.toISOString() ?? new Date().toISOString(),
                  connected: true,
                  dataSource: 'live',
                },
                (c) => c.role === 'mentor',
              );
              logger.info(
                { sessionId: client.sessionId, studentId: live.studentId },
                'Relayed live Student Agent state to mentor dashboard',
              );
            }
            return;
          }

          if (parsed.type === 'heartbeat') {
            if (client.role === 'student') {
              await deps.sessions.assertStudentSessionActive(client.sessionId, client.studentId!);
              deps.sessions.recordHeartbeat(client.sessionId);
              logger.info(
                { sessionId: client.sessionId, studentId: client.studentId },
                'Received native Student Agent heartbeat',
              );
            }
            return;
          }

          if (parsed.type === 'leave_session') {
            if (client.role === 'student') {
              const sessionId = client.sessionId;
              const studentId = client.studentId!;
              deps.sessions.markDisconnected(sessionId);
              hub.broadcast(sessionId, {
                type: 'student_disconnected',
                studentId,
              });
              hub.send(client, {
                type: 'session_end',
                reason: 'student_left',
              });
            }
            ws.close();
          }
        } catch (err) {
          logger.warn({ err }, 'WebSocket message error');
          send(ws, {
            type: 'error',
            code: 'BAD_MESSAGE',
            message: err instanceof Error ? err.message : 'Bad message',
          });
        }
      })();
    });

    ws.on('close', () => {
      if (!client) return;
      hub.remove(client);
      if (client.role === 'student') {
        deps.sessions.markDisconnected(client.sessionId);
        hub.broadcast(client.sessionId, {
          type: 'student_disconnected',
          studentId: client.studentId!,
        });
      }
    });
  });

  return {
    wss,
    hub,
    broadcastSessionEnd(
      sessionId: string,
      reason: 'mentor_ended' | 'expired' | 'student_left' | 'error',
    ) {
      hub.broadcast(sessionId, { type: 'session_end', reason });
    },
    broadcastConfigUpdate(sessionId: string, config: SessionConfig) {
      hub.broadcast(sessionId, { type: 'config_update', config });
    },
  };
}

function send(ws: WebSocket, event: ServerToClientEvent) {
  if (ws.readyState === ws.OPEN) {
    ws.send(JSON.stringify(event));
  }
}
