export type {
  FocusState,
  MentorSettings,
  SessionResponse,
  SessionSummary,
} from '@focusmentor/contracts';

export interface Mentor {
  id: string;
  email: string;
  name: string;
}

export interface Student {
  id: string;
  name: string;
  email: string | null;
  createdAt: string;
}
