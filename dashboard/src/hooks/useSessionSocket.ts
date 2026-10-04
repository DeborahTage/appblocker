import { useEffect } from 'react';
import { ServerToClientEventSchema } from '@focusmentor/contracts';
import { api } from '../api/client';
import { useLiveStore } from '../stores/liveStore';

const WS_BASE =
  import.meta.env.VITE_WS_BASE_URL ??
  `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`;

export function useSessionSocket(sessionId: string | undefined, enabled: boolean) {
  const setLive = useLiveStore((s) => s.setLive);
  const setSocketStatus = useLiveStore((s) => s.setSocketStatus);
  const clear = useLiveStore((s) => s.clear);

  useEffect(() => {
    if (!sessionId || !enabled) return;

    let ws: WebSocket | null = null;
    let closed = false;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;

    const connect = async () => {
      setSocketStatus(sessionId, 'connecting');
      try {
        const { ticket } = await api.wsTicket(sessionId);
        if (closed) return;
        ws = new WebSocket(WS_BASE);
        ws.onopen = () => {
          ws?.send(
            JSON.stringify({
              type: 'join_session',
              sessionId,
              token: ticket,
              clientType: 'mentor_dashboard',
            }),
          );
        };
        ws.onmessage = (ev) => {
          let raw: unknown;
          try {
            raw = JSON.parse(String(ev.data));
          } catch {
            setSocketStatus(sessionId, 'error');
            return;
          }
          const parsed = ServerToClientEventSchema.safeParse(raw);
          if (!parsed.success) {
            setSocketStatus(sessionId, 'error');
            return;
          }
          const event = parsed.data;
          if (event.type === 'join_ack') {
            setSocketStatus(sessionId, 'connected');
          }
          if (event.type === 'student_state') {
            setLive(sessionId, {
              studentId: event.studentId,
              studentName: event.studentName,
              state: event.state,
              currentApp: event.currentApp,
              processName: event.processName,
              lastUpdated: event.lastUpdated,
              connected: event.connected,
              dataSource: event.dataSource,
            });
          }
          if (event.type === 'student_connected') {
            const prev = useLiveStore.getState().bySession[sessionId];
            if (prev) setLive(sessionId, { ...prev, connected: true });
          }
          if (event.type === 'student_disconnected') {
            const prev = useLiveStore.getState().bySession[sessionId];
            if (prev) setLive(sessionId, { ...prev, connected: false, state: 'Disconnected' });
          }
          if (event.type === 'session_end') {
            clear(sessionId);
            closed = true;
            ws?.close();
          }
          if (event.type === 'error') {
            setSocketStatus(sessionId, 'error');
          }
        };
        ws.onerror = () => setSocketStatus(sessionId, 'error');
        ws.onclose = () => {
          if (closed) return;
          setSocketStatus(sessionId, 'disconnected');
          retryTimer = setTimeout(() => void connect(), 2_000);
        };
      } catch {
        setSocketStatus(sessionId, 'error');
        if (!closed) retryTimer = setTimeout(() => void connect(), 2_000);
      }
    };

    void connect();

    return () => {
      closed = true;
      if (retryTimer) clearTimeout(retryTimer);
      ws?.close();
    };
  }, [sessionId, enabled, setLive, setSocketStatus, clear]);
}
