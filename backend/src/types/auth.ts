export type JwtRole = 'mentor' | 'student' | 'ws_ticket';

export interface MentorJwtPayload {
  sub: string;
  role: 'mentor';
  email: string;
}

export interface StudentJwtPayload {
  sub: string;
  role: 'student';
  sessionId: string;
  studentId: string;
}

export interface WsTicketPayload {
  sub: string;
  role: 'ws_ticket';
  mentorId: string;
  sessionId?: string;
}

export type AuthPayload = MentorJwtPayload | StudentJwtPayload | WsTicketPayload;
