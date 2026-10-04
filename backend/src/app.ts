import express, { type Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import type { Env } from './types/env.js';
import { createRoutes } from './routes/index.js';
import { errorHandler } from './middleware/errorHandler.js';
import type { AuthService } from './services/authService.js';
import type { SessionService } from './services/sessionService.js';
import type { StudentService } from './services/studentService.js';
import type { SettingsService } from './services/settingsService.js';
import type { JwtService } from './services/jwtService.js';

export function createApp(deps: {
  env: Env;
  auth: AuthService;
  sessions: SessionService;
  students: StudentService;
  settings: SettingsService;
  jwt: JwtService;
}): Express {
  const app = express();
  app.set('trust proxy', 1);

  app.use(helmet());
  app.use(
    cors({
      origin: deps.env.CORS_ORIGINS.split(',').map((s) => s.trim()),
      credentials: true,
    }),
  );
  app.use(express.json({ limit: '32kb' }));
  app.use(cookieParser());
  app.use(
    rateLimit({
      windowMs: deps.env.RATE_LIMIT_WINDOW_MS,
      max: deps.env.RATE_LIMIT_MAX,
      standardHeaders: true,
      legacyHeaders: false,
    }),
  );

  app.use(
    '/api',
    createRoutes({
      auth: deps.auth,
      sessions: deps.sessions,
      students: deps.students,
      settings: deps.settings,
      jwt: deps.jwt,
      env: deps.env,
    }),
  );

  app.use(errorHandler);
  return app;
}
