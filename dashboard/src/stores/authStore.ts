import { create } from 'zustand';
import type { Mentor } from '../types';

interface AuthState {
  mentor: Mentor | null;
  setMentor: (mentor: Mentor | null) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  mentor: null,
  setMentor: (mentor) => set({ mentor }),
}));
