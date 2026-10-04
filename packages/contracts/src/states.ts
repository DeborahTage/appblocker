import { z } from 'zod';

/** Focus state machine states for a student during a lesson session. */
export const FocusStateSchema = z.enum([
  'Disconnected',
  'Waiting',
  'OnTask',
  'Away',
  'BlockedAppDetected',
  'SessionEnded',
]);

export type FocusState = z.infer<typeof FocusStateSchema>;

export const SIGNAL_COLORS: Record<FocusState, 'green' | 'yellow' | 'red' | 'gray'> = {
  Disconnected: 'gray',
  Waiting: 'yellow',
  OnTask: 'green',
  Away: 'yellow',
  BlockedAppDetected: 'red',
  SessionEnded: 'gray',
};
