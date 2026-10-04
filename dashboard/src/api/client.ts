import type { MentorSettings, SessionConfig, SessionResponse } from '@focusmentor/contracts';
import type { Student } from '../types';
import { getCsrfFromCookie } from '../utils/format';

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? '/api';

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (!headers.has('Content-Type') && init.body) {
    headers.set('Content-Type', 'application/json');
  }
  const csrf = getCsrfFromCookie();
  if (csrf) headers.set('X-CSRF-Token', csrf);

  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers,
    credentials: 'include',
  });

  if (res.status === 204) return undefined as T;

  const data = (await res.json().catch(() => ({}))) as {
    error?: { code?: string; message?: string };
  };

  if (!res.ok) {
    throw new ApiError(
      res.status,
      data.error?.code ?? 'ERROR',
      data.error?.message ?? res.statusText,
    );
  }
  return data as T;
}

export const api = {
  login: (email: string, password: string) =>
    request<{ mentor: { id: string; email: string; name: string }; csrfToken: string }>(
      '/auth/login',
      {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      },
    ),
  logout: () => request<void>('/auth/logout', { method: 'POST' }),
  me: () => request<{ mentor: { id: string; email: string; name?: string } }>('/auth/me'),
  listStudents: () => request<{ students: Student[] }>('/students'),
  createStudent: (name: string, email?: string) =>
    request<Student>('/students', {
      method: 'POST',
      body: JSON.stringify({ name, email }),
    }),
  listSessions: () => request<{ sessions: SessionResponse[] }>('/sessions'),
  getSession: (id: string) => request<SessionResponse>(`/sessions/${id}`),
  createSession: (body: {
    studentId: string;
    durationMinutes: number;
    config?: Record<string, unknown>;
  }) =>
    request<SessionResponse>('/sessions', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  endSession: (id: string) =>
    request<SessionResponse>(`/sessions/${id}/end`, {
      method: 'POST',
    }),
  updateSessionConfig: (id: string, config: Record<string, unknown>) =>
    request<{ config: SessionConfig }>(`/sessions/${id}/config`, {
      method: 'PATCH',
      body: JSON.stringify(config),
    }),
  getSettings: () => request<{ settings: MentorSettings }>('/settings'),
  updateSettings: (settings: Partial<MentorSettings>) =>
    request<{ settings: MentorSettings }>('/settings', {
      method: 'PUT',
      body: JSON.stringify(settings),
    }),
  wsTicket: (sessionId?: string) =>
    request<{ ticket: string; expiresInSeconds: number }>(
      sessionId ? `/sessions/${sessionId}/ws-ticket` : '/auth/ws-ticket',
      { method: 'POST' },
    ),
};
