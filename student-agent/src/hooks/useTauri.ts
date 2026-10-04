import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { Store } from '@tauri-apps/plugin-store';
import { useEffect } from 'react';
import {
  useAgentStore,
  type AgentStatus,
  type DebugTelemetry,
  type FocusState,
} from '../stores/agentStore';

const DEFAULT_API = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000/api';
const DEFAULT_WS = import.meta.env.VITE_WS_BASE_URL ?? 'ws://localhost:4000/ws';

export function isNativeRuntime(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

export async function loadConsent(): Promise<boolean> {
  try {
    const store = await Store.load('settings.json');
    return Boolean(await store.get<boolean>('consentAgreed'));
  } catch {
    return localStorage.getItem('fm_consent') === '1';
  }
}

export async function saveConsent(): Promise<void> {
  try {
    const store = await Store.load('settings.json');
    await store.set('consentAgreed', true);
    await store.save();
  } catch {
    localStorage.setItem('fm_consent', '1');
  }
}

export function useAgentBootstrap() {
  const setFromStatus = useAgentStore((s) => s.setFromStatus);
  const setConsented = useAgentStore((s) => s.setConsented);
  const setFocus = useAgentStore((s) => s.setFocus);

  useEffect(() => {
    let unsubs: Array<() => void> = [];

    void (async () => {
      const consented = await loadConsent();
      if (consented && isNativeRuntime()) {
        setConsented(true);
        await invoke('set_consent', { agreed: true });
      }

      if (!isNativeRuntime()) {
        setConsented(consented);
        return;
      }

      try {
        const status = await invoke<AgentStatus>('get_status');
        setFromStatus(status);
        const telemetry = await invoke<DebugTelemetry>('get_debug_telemetry');
        useAgentStore.getState().setDebugTelemetry(telemetry);
      } catch (error) {
        useAgentStore
          .getState()
          .setError(error instanceof Error ? error.message : String(error));
      }

      try {
        unsubs = [
          await listen<{
            state: FocusState;
            current_app: string | null;
            process_name: string | null;
          }>('focus-state', (e) => {
            setFocus(e.payload.state, e.payload.current_app, e.payload.process_name);
          }),
          await listen<DebugTelemetry>('debug-telemetry', (e) => {
            useAgentStore.getState().setDebugTelemetry(e.payload);
          }),
          await listen('ws-connected', () => {
            useAgentStore.getState().setWebsocketStatus('connected');
          }),
          await listen('ws-disconnected', () => {
            useAgentStore.getState().setWebsocketStatus('disconnected');
          }),
          await listen<string>('detection-error', (e) => {
            useAgentStore.getState().setError(e.payload);
          }),
          await listen('session-ended', () => {
            void invoke<AgentStatus>('get_status').then(setFromStatus);
          }),
        ].map((u) => () => void u());
      } catch (error) {
        useAgentStore
          .getState()
          .setError(error instanceof Error ? error.message : String(error));
      }
    })();

    return () => unsubs.forEach((u) => u());
  }, [setConsented, setFocus, setFromStatus]);
}

export async function agreeConsent(): Promise<void> {
  await saveConsent();
  if (isNativeRuntime()) {
    await invoke('set_consent', { agreed: true });
  }
  useAgentStore.getState().setConsented(true);
}

export async function joinWithCode(pairingCode: string): Promise<void> {
  if (!isNativeRuntime()) {
    throw new Error(
      'Live monitoring requires the native Tauri Student Agent. Browser preview cannot join sessions and never generates fake activity.',
    );
  }

  const status = await invoke<AgentStatus>('join_session', {
    payload: {
      pairingCode,
      apiBase: DEFAULT_API,
      wsUrl: DEFAULT_WS,
    },
  });
  useAgentStore.getState().setFromStatus(status);
}

export async function leaveSession(): Promise<void> {
  if (!isNativeRuntime()) {
    throw new Error('No native lesson session is running.');
  }

  try {
    const status = await invoke<AgentStatus>('leave_session');
    useAgentStore.getState().setFromStatus(status);
  } catch (error) {
    useAgentStore
      .getState()
      .setError(error instanceof Error ? error.message : String(error));
    throw error;
  }
}
