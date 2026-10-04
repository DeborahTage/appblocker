import type { Response } from 'express';
import {
  CreateSessionRequestSchema,
  JoinSessionRequestSchema,
  MentorSettingsSchema,
  SessionConfigSchema,
} from '@focusmentor/contracts';
import type { SessionService } from '../services/sessionService.js';
import type { JwtService } from '../services/jwtService.js';
import type { AuthedRequest } from '../middleware/auth.js';

export function createSessionController(sessions: SessionService, jwt: JwtService) {
  return {
    async create(req: AuthedRequest, res: Response) {
      const body = CreateSessionRequestSchema.parse(req.body);
      const session = await sessions.create(req.mentor!.sub, body);
      res.status(201).json(session);
    },

    async join(req: AuthedRequest, res: Response) {
      const body = JoinSessionRequestSchema.parse(req.body);
      const result = await sessions.join(body.pairingCode);
      res.json(result);
    },

    async get(req: AuthedRequest, res: Response) {
      const session = await sessions.getById(String(req.params.id), req.mentor!.sub);
      res.json(session);
    },

    async list(req: AuthedRequest, res: Response) {
      const list = await sessions.listForMentor(req.mentor!.sub);
      res.json({ sessions: list });
    },

    async end(req: AuthedRequest, res: Response) {
      const session = await sessions.end(String(req.params.id), req.mentor!.sub, 'mentor_ended');
      res.json(session);
    },

    async getConfig(req: AuthedRequest, res: Response) {
      const session = await sessions.getById(String(req.params.id), req.mentor!.sub);
      res.json({ config: session.config, domainMatchingSupported: false });
    },

    async updateConfig(req: AuthedRequest, res: Response) {
      const patch = SessionConfigSchema.partial().parse(req.body);
      const config = await sessions.updateConfig(String(req.params.id), req.mentor!.sub, patch);
      res.json({ config });
    },

    async wsTicket(req: AuthedRequest, res: Response) {
      const sessionId = typeof req.query.sessionId === 'string' ? req.query.sessionId : undefined;
      if (sessionId) {
        await sessions.getById(sessionId, req.mentor!.sub);
      }
      const ticket = jwt.signWsTicket({
        mentorId: req.mentor!.sub,
        sessionId,
      });
      res.json({ ticket, expiresInSeconds: 120 });
    },
  };
}

export function createSettingsController(
  update: (
    mentorId: string,
    patch: Partial<ReturnType<typeof MentorSettingsSchema.parse>>,
  ) => Promise<unknown>,
  get: (mentorId: string) => Promise<unknown>,
) {
  return {
    async getSettings(req: AuthedRequest, res: Response) {
      res.json({ settings: await get(req.mentor!.sub) });
    },
    async updateSettings(req: AuthedRequest, res: Response) {
      const patch = MentorSettingsSchema.partial().parse(req.body);
      res.json({ settings: await update(req.mentor!.sub, patch) });
    },
  };
}
