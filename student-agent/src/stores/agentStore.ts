import { create } from 'zustand';

export type FocusState =
  | 'Disconnected'
  | 'Waiting'
  | 'OnTask'
  | 'Away'
  | 'BlockedAppDetected'
  | 'SessionEnded';

export interface DetectionCapability {
  supported: boolean;
  platform: string;
  sessionType: string;
  dataSource: string;
  message: string | null;
}

export interface DebugLogEntry {
  timestamp: string;
  level: string;
  message: string;
}

export interface DebugTelemetry {
  capability: DetectionCapability;
  currentForegroundApplication: string | null;
  processName: string | null;
  windowTitle: string | null;
  currentState: FocusState;
  websocketStatus: string;
  lastHeartbeatAt: string | null;
  lastStateSentAt: string | null;
  lastMessageReceivedAt: string | null;
  lastError: string | null;
  logs: DebugLogEntry[];
}

export interface AgentStatus {
  consented: boolean;
  focusState: FocusState;
  currentApp: string | null;
  processName: string | null;
  windowTitle: string | null;
  monitoring: boolean;
  studentName: string | null;
  sessionId: string | null;
  domainMatchingSupported: boolean;
  runtimeMode: 'native';
  capability: DetectionCapability;
  websocketStatus: string;
  lastHeartbeatAt: string | null;
  lastError: string | null;
}

interface AgentStore {
  consented: boolean;
  focusState: FocusState;
  currentApp: string | null;
  processName: string | null;
  windowTitle: string | null;
  monitoring: boolean;
  studentName: string | null;
  sessionId: string | null;
  error: string | null;
  runtimeMode: 'native' | 'browser';
  capability: DetectionCapability;
  websocketStatus: string;
  lastHeartbeatAt: string | null;
  debugTelemetry: DebugTelemetry | null;
  setFromStatus: (status: AgentStatus) => void;
  setConsented: (value: boolean) => void;
  setError: (error: string | null) => void;
  setFocus: (state: FocusState, app: string | null, processName: string | null) => void;
  setWebsocketStatus: (status: string) => void;
  setDebugTelemetry: (telemetry: DebugTelemetry) => void;
}

const unavailableCapability: DetectionCapability = {
  supported: false,
  platform: 'browser',
  sessionType: 'browser-preview',
  dataSource: 'unavailable',
  message:
    'Native foreground detection is unavailable in a web browser. Launch the Tauri desktop application.',
};

export const useAgentStore = create<AgentStore>((set) => ({
  consented: false,
  focusState: 'Disconnected',
  currentApp: null,
  processName: null,
  windowTitle: null,
  monitoring: false,
  studentName: null,
  sessionId: null,
  error: null,
  runtimeMode: 'browser',
  capability: unavailableCapability,
  websocketStatus: 'disconnected',
  lastHeartbeatAt: null,
  debugTelemetry: null,
  setFromStatus: (status) => set(status),
  setConsented: (consented) => set({ consented }),
  setError: (error) => set({ error }),
  setFocus: (focusState, currentApp, processName) =>
    set({ focusState, currentApp, processName }),
  setWebsocketStatus: (websocketStatus) => set({ websocketStatus }),
  setDebugTelemetry: (debugTelemetry) =>
    set({
      debugTelemetry,
      capability: debugTelemetry.capability,
      currentApp: debugTelemetry.currentForegroundApplication,
      processName: debugTelemetry.processName,
      windowTitle: debugTelemetry.windowTitle,
      focusState: debugTelemetry.currentState,
      websocketStatus: debugTelemetry.websocketStatus,
      lastHeartbeatAt: debugTelemetry.lastHeartbeatAt,
      error: debugTelemetry.lastError,
    }),
}));

export function statusColor(state: FocusState): string {
  switch (state) {
    case 'OnTask':
      return 'status-green';
    case 'Away':
    case 'Waiting':
      return 'status-yellow';
    case 'BlockedAppDetected':
      return 'status-red';
    default:
      return 'status-gray';
  }
}
