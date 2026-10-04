import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LiveStudentCard } from './LiveStudentCard';
import type { SessionResponse } from '@focusmentor/contracts';

vi.mock('../hooks/useSessionSocket', () => ({
  useSessionSocket: () => undefined,
}));

const session: SessionResponse = {
  id: '11111111-1111-1111-1111-111111111111',
  mentorId: '22222222-2222-2222-2222-222222222222',
  studentId: '33333333-3333-3333-3333-333333333333',
  studentName: 'Alex Student',
  pairingCode: 'ABCD-1234',
  status: 'active',
  expiresAt: new Date().toISOString(),
  createdAt: new Date().toISOString(),
  endedAt: null,
  config: {
    allowedApps: ['Code.exe'],
    blockedApps: ['Discord.exe'],
    allowedDomains: [],
    blockedDomains: [],
    enableSessionSummary: false,
    summaryRetentionHours: 24,
  },
  live: {
    studentId: '33333333-3333-3333-3333-333333333333',
    studentName: 'Alex Student',
    currentState: 'OnTask',
    currentApp: 'VS Code',
    processName: 'Code.exe',
    lastUpdated: new Date().toISOString(),
    connected: true,
    dataSource: 'live',
    elapsedSeconds: 42,
  },
  summary: null,
};

describe('LiveStudentCard', () => {
  it('renders student focus card', () => {
    render(<LiveStudentCard session={session} onEnd={() => undefined} />);
    expect(screen.getByText('Alex Student')).toBeInTheDocument();
    expect(screen.getByText('VS Code')).toBeInTheDocument();
    expect(screen.getByText(/ABCD-1234/)).toBeInTheDocument();
  });
});
