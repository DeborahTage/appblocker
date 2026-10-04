import jwt from 'jsonwebtoken';
import type { Env } from '../types/env.js';
import type {
  AuthPayload,
  MentorJwtPayload,
  StudentJwtPayload,
  WsTicketPayload,
} from '../types/auth.js';
import { UnauthorizedError } from '../utils/errors.js';

export class JwtService {
  constructor(private readonly env: Env) {}

  signMentor(payload: Omit<MentorJwtPayload, 'role'>): string {
    return jwt.sign(
      { ...payload, role: 'mentor' satisfies MentorJwtPayload['role'] },
      this.env.JWT_SECRET,
      {
        expiresIn: this.env.JWT_MENTOR_TTL,
      } as jwt.SignOptions,
    );
  }

  signStudent(payload: Omit<StudentJwtPayload, 'role'>): string {
    return jwt.sign(
      { ...payload, role: 'student' satisfies StudentJwtPayload['role'] },
      this.env.JWT_SECRET,
      { expiresIn: this.env.JWT_STUDENT_TTL } as jwt.SignOptions,
    );
  }

  signWsTicket(payload: Omit<WsTicketPayload, 'role' | 'sub'> & { sub?: string }): string {
    return jwt.sign(
      {
        sub: payload.sub ?? payload.mentorId,
        mentorId: payload.mentorId,
        sessionId: payload.sessionId,
        role: 'ws_ticket' satisfies WsTicketPayload['role'],
      },
      this.env.JWT_SECRET,
      { expiresIn: this.env.JWT_WS_TICKET_TTL } as jwt.SignOptions,
    );
  }

  verify(token: string): AuthPayload {
    try {
      const decoded = jwt.verify(token, this.env.JWT_SECRET) as AuthPayload;
      if (!decoded?.role || !decoded.sub) {
        throw new UnauthorizedError('Invalid token');
      }
      return decoded;
    } catch {
      throw new UnauthorizedError('Invalid or expired token');
    }
  }
}
