import { create } from 'zustand';
import type { FocusState } from '@focusmentor/contracts';

export interface LiveCard {
  studentId: string;
  studentName: string;
  state: FocusState;
  currentApp: string | null;
  processName: string | null;
  lastUpdated: string | null;
  connected: boolean;
  dataSource: 'live' | 'none';
}

interface LiveState {
  bySession: Record<string, LiveCard | undefined>;
  socketBySession: Record<string, 'connecting' | 'connected' | 'disconnected' | 'error'>;
  setLive: (sessionId: string, card: LiveCard) => void;
  setSocketStatus: (
    sessionId: string,
    status: 'connecting' | 'connected' | 'disconnected' | 'error',
  ) => void;
  clear: (sessionId: string) => void;
}

export const useLiveStore = create<LiveState>((set) => ({
  bySession: {},
  socketBySession: {},
  setLive: (sessionId, card) => set((s) => ({ bySession: { ...s.bySession, [sessionId]: card } })),
  setSocketStatus: (sessionId, status) =>
    set((state) => ({
      socketBySession: { ...state.socketBySession, [sessionId]: status },
    })),
  clear: (sessionId) =>
    set((s) => {
      const next = { ...s.bySession };
      const nextSockets = { ...s.socketBySession };
      delete next[sessionId];
      delete nextSockets[sessionId];
      return { bySession: next, socketBySession: nextSockets };
    }),
}));
