import { createServer } from 'node:http';
import { loadEnv } from './types/env.js';
import { createContainer } from './container.js';
import { createApp } from './app.js';
import { attachWebSocketServer } from './websocket/handler.js';
import { logger } from './utils/logger.js';

async function main() {
  const env = loadEnv();
  const container = createContainer(env);
  const app = createApp({
    env,
    auth: container.auth,
    sessions: container.sessions,
    students: container.students,
    settings: container.settings,
    jwt: container.jwt,
  });

  const server = createServer(app);
  const ws = attachWebSocketServer(server, {
    jwt: container.jwt,
    sessions: container.sessions,
  });

  // Patch end/config to notify sockets
  const originalEnd = container.sessions.end.bind(container.sessions);
  container.sessions.end = async (...args) => {
    const [sessionId, , reason = 'mentor_ended'] = args;
    const result = await originalEnd(...args);
    ws.broadcastSessionEnd(sessionId, reason);
    return result;
  };

  const originalUpdateConfig = container.sessions.updateConfig.bind(container.sessions);
  container.sessions.updateConfig = async (...args) => {
    const config = await originalUpdateConfig(...args);
    ws.broadcastConfigUpdate(args[0], config);
    return config;
  };

  const cleanupTimer = setInterval(() => {
    void container.sessions.cleanupExpiredSummaries().catch((err) => {
      logger.warn({ err }, 'Summary cleanup failed');
    });
    void container.sessions.expireStaleSessions().catch((err) => {
      logger.warn({ err }, 'Session expiry sweep failed');
    });
  }, env.SUMMARY_CLEANUP_INTERVAL_MS);

  server.listen(env.PORT, () => {
    logger.info({ port: env.PORT }, 'FocusMentor backend listening');
  });

  const shutdown = async () => {
    clearInterval(cleanupTimer);
    ws.wss.close();
    server.close();
    await container.prisma.$disconnect();
    process.exit(0);
  };

  process.on('SIGTERM', () => void shutdown());
  process.on('SIGINT', () => void shutdown());
}

main().catch((err) => {
  logger.fatal({ err }, 'Failed to start');
  process.exit(1);
});
