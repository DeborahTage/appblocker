import { describe, expect, it } from 'vitest';
import { JwtService } from './jwtService.js';
import { loadEnv } from '../types/env.js';

describe('JwtService', () => {
  const env = loadEnv({
    ...process.env,
    JWT_SECRET: 'test-secret-that-is-long-enough-123456',
    DATABASE_URL: 'postgresql://x:x@localhost:5432/x',
  });
  const jwt = new JwtService(env);

  it('round-trips mentor tokens', () => {
    const token = jwt.signMentor({ sub: 'm1', email: 'a@b.com' });
    const payload = jwt.verify(token);
    expect(payload.role).toBe('mentor');
    expect(payload.sub).toBe('m1');
  });

  it('round-trips student tokens bound to session', () => {
    const token = jwt.signStudent({
      sub: 'st1',
      studentId: 'st1',
      sessionId: 'sess1',
    });
    const payload = jwt.verify(token);
    expect(payload.role).toBe('student');
    if (payload.role === 'student') {
      expect(payload.sessionId).toBe('sess1');
    }
  });
});
