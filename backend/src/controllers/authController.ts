import type { Response } from 'express';
import { LoginRequestSchema } from '@focusmentor/contracts';
import type { AuthService } from '../services/authService.js';
import type { Env } from '../types/env.js';
import type { AuthedRequest } from '../middleware/auth.js';
import { COOKIE_NAME, CSRF_COOKIE } from '../middleware/auth.js';

export function createAuthController(auth: AuthService, env: Env) {
  return {
    async login(req: AuthedRequest, res: Response) {
      const body = LoginRequestSchema.parse(req.body);
      const result = await auth.login(body.email, body.password);

      res.cookie(COOKIE_NAME, result.token, {
        httpOnly: true,
        secure: env.COOKIE_SECURE,
        sameSite: env.COOKIE_SAME_SITE,
        maxAge: 8 * 60 * 60 * 1000,
      });
      res.cookie(CSRF_COOKIE, result.csrfToken, {
        httpOnly: false,
        secure: env.COOKIE_SECURE,
        sameSite: env.COOKIE_SAME_SITE,
        maxAge: 8 * 60 * 60 * 1000,
      });

      res.json({ mentor: result.mentor, csrfToken: result.csrfToken });
    },

    async logout(_req: AuthedRequest, res: Response) {
      res.clearCookie(COOKIE_NAME);
      res.clearCookie(CSRF_COOKIE);
      res.status(204).send();
    },

    async me(req: AuthedRequest, res: Response) {
      const mentor = await auth.getMentor(req.mentor!.sub);
      res.json({ mentor });
    },
  };
}
