import type { NextFunction, Request, Response } from 'express';
import type { JwtService } from '../services/jwtService.js';
import type { MentorJwtPayload } from '../types/auth.js';
import { ForbiddenError, UnauthorizedError } from '../utils/errors.js';

export interface AuthedRequest extends Request {
  mentor?: MentorJwtPayload;
  csrfToken?: string;
}

const COOKIE_NAME = 'fm_mentor_token';
const CSRF_COOKIE = 'fm_csrf';

export function mentorAuth(jwt: JwtService) {
  return (req: AuthedRequest, _res: Response, next: NextFunction) => {
    try {
      const header = req.headers.authorization;
      const bearer = header?.startsWith('Bearer ') ? header.slice(7) : undefined;
      const cookieToken = req.cookies?.[COOKIE_NAME] as string | undefined;
      const token = bearer ?? cookieToken;
      if (!token) throw new UnauthorizedError();

      const payload = jwt.verify(token);
      if (payload.role !== 'mentor') throw new ForbiddenError('Mentor role required');
      req.mentor = payload;
      next();
    } catch (err) {
      next(err);
    }
  };
}

export function csrfProtection() {
  return (req: AuthedRequest, _res: Response, next: NextFunction) => {
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      next();
      return;
    }
    // Bearer-token API clients (tests / agent tooling) skip cookie CSRF.
    if (req.headers.authorization?.startsWith('Bearer ')) {
      next();
      return;
    }
    const cookie = req.cookies?.[CSRF_COOKIE] as string | undefined;
    const header = req.headers['x-csrf-token'];
    if (!cookie || !header || cookie !== header) {
      next(new ForbiddenError('Invalid CSRF token'));
      return;
    }
    next();
  };
}

export { COOKIE_NAME, CSRF_COOKIE };
