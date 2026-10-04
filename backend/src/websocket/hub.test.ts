import { describe, expect, it, vi } from 'vitest';
import { SessionHub } from './hub.js';

describe('SessionHub', () => {
  it('broadcasts only to matching clients', () => {
    const hub = new SessionHub();
    const send = vi.fn();
    const mentor = {
      ws: { readyState: 1, OPEN: 1, send } as never,
      role: 'mentor' as const,
      sessionId: 's1',
      mentorId: 'm1',
    };
    const student = {
      ws: { readyState: 1, OPEN: 1, send: vi.fn() } as never,
      role: 'student' as const,
      sessionId: 's1',
      studentId: 'st1',
    };
    hub.add(mentor);
    hub.add(student);
    hub.broadcast(
      's1',
      { type: 'session_end', reason: 'mentor_ended' },
      (c) => c.role === 'mentor',
    );
    expect(send).toHaveBeenCalledOnce();
  });
});
