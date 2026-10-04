import type { Env } from './types/env.js';
import { prisma } from './services/prisma.js';
import { JwtService } from './services/jwtService.js';
import { AuthService } from './services/authService.js';
import { SettingsService } from './services/settingsService.js';
import { StudentService } from './services/studentService.js';
import { SessionService } from './services/sessionService.js';
import { InMemoryLiveStateStore } from './models/liveState.js';

export function createContainer(env: Env) {
  const live = new InMemoryLiveStateStore();
  const jwt = new JwtService(env);
  const auth = new AuthService(prisma, jwt);
  const settings = new SettingsService(prisma);
  const students = new StudentService(prisma);
  const sessions = new SessionService(prisma, live, jwt, settings, env);

  return {
    prisma,
    live,
    jwt,
    auth,
    settings,
    students,
    sessions,
  };
}

export type Container = ReturnType<typeof createContainer>;
