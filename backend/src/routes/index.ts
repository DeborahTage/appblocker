import { Router, type Router as ExpressRouter } from 'express';
import type { AuthService } from '../services/authService.js';
import type { SessionService } from '../services/sessionService.js';
import type { StudentService } from '../services/studentService.js';
import type { SettingsService } from '../services/settingsService.js';
import type { JwtService } from '../services/jwtService.js';
import type { Env } from '../types/env.js';
import { csrfProtection, mentorAuth } from '../middleware/auth.js';
import { createAuthController } from '../controllers/authController.js';
import {
  createSessionController,
  createSettingsController,
} from '../controllers/sessionController.js';
import { createStudentController } from '../controllers/studentController.js';

export function createRoutes(deps: {
  auth: AuthService;
  sessions: SessionService;
  students: StudentService;
  settings: SettingsService;
  jwt: JwtService;
  env: Env;
}): ExpressRouter {
  const router = Router();
  const authCtrl = createAuthController(deps.auth, deps.env);
  const sessionCtrl = createSessionController(deps.sessions, deps.jwt);
  const studentCtrl = createStudentController(deps.students);
  const settingsCtrl = createSettingsController(
    (id, patch) => deps.settings.update(id, patch),
    (id) => deps.settings.getOrCreate(id),
  );

  const requireMentor = mentorAuth(deps.jwt);
  const csrf = csrfProtection();

  router.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  router.get('/ready', (_req, res) => {
    res.json({ status: 'ready' });
  });

  router.post('/auth/login', (req, res, next) => {
    void authCtrl.login(req, res).catch(next);
  });
  router.post('/auth/logout', requireMentor, csrf, (req, res, next) => {
    void authCtrl.logout(req, res).catch(next);
  });
  router.get('/auth/me', requireMentor, (req, res, next) => {
    void authCtrl.me(req, res).catch(next);
  });

  router.post('/sessions', requireMentor, csrf, (req, res, next) => {
    void sessionCtrl.create(req, res).catch(next);
  });
  router.get('/sessions', requireMentor, (req, res, next) => {
    void sessionCtrl.list(req, res).catch(next);
  });
  router.post('/sessions/join', (req, res, next) => {
    void sessionCtrl.join(req, res).catch(next);
  });
  router.post('/sessions/:id/end', requireMentor, csrf, (req, res, next) => {
    void sessionCtrl.end(req, res).catch(next);
  });
  // Spec alias
  router.post('/sessions/end', requireMentor, csrf, (req, res, next) => {
    const id = String(req.body?.sessionId ?? '');
    req.params.id = id;
    void sessionCtrl.end(req, res).catch(next);
  });
  router.get('/sessions/:id', requireMentor, (req, res, next) => {
    void sessionCtrl.get(req, res).catch(next);
  });
  router.get('/config', requireMentor, (req, res, next) => {
    const id = String(req.query.sessionId ?? '');
    req.params.id = id;
    void sessionCtrl.getConfig(req, res).catch(next);
  });
  router.get('/sessions/:id/config', requireMentor, (req, res, next) => {
    void sessionCtrl.getConfig(req, res).catch(next);
  });
  router.patch('/sessions/:id/config', requireMentor, csrf, (req, res, next) => {
    void sessionCtrl.updateConfig(req, res).catch(next);
  });
  router.post('/sessions/:id/ws-ticket', requireMentor, csrf, (req, res, next) => {
    req.query.sessionId = String(req.params.id);
    void sessionCtrl.wsTicket(req, res).catch(next);
  });
  router.post('/auth/ws-ticket', requireMentor, csrf, (req, res, next) => {
    void sessionCtrl.wsTicket(req, res).catch(next);
  });

  router.get('/students', requireMentor, (req, res, next) => {
    void studentCtrl.list(req, res).catch(next);
  });
  router.post('/students', requireMentor, csrf, (req, res, next) => {
    void studentCtrl.create(req, res).catch(next);
  });
  router.get('/students/:id', requireMentor, (req, res, next) => {
    void studentCtrl.get(req, res).catch(next);
  });

  router.get('/settings', requireMentor, (req, res, next) => {
    void settingsCtrl.getSettings(req, res).catch(next);
  });
  router.put('/settings', requireMentor, csrf, (req, res, next) => {
    void settingsCtrl.updateSettings(req, res).catch(next);
  });

  return router;
}
