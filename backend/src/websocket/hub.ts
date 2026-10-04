import type { WebSocket } from 'ws';
import type { ServerToClientEvent } from '@focusmentor/contracts';

export interface HubClient {
  ws: WebSocket;
  role: 'student' | 'mentor';
  sessionId: string;
  mentorId?: string;
  studentId?: string;
}

export class SessionHub {
  private readonly bySession = new Map<string, Set<HubClient>>();

  add(client: HubClient): void {
    let set = this.bySession.get(client.sessionId);
    if (!set) {
      set = new Set();
      this.bySession.set(client.sessionId, set);
    }
    set.add(client);
  }

  remove(client: HubClient): void {
    const set = this.bySession.get(client.sessionId);
    if (!set) return;
    set.delete(client);
    if (set.size === 0) this.bySession.delete(client.sessionId);
  }

  broadcast(sessionId: string, event: ServerToClientEvent, filter?: (c: HubClient) => boolean) {
    const set = this.bySession.get(sessionId);
    if (!set) return;
    const raw = JSON.stringify(event);
    for (const client of set) {
      if (filter && !filter(client)) continue;
      if (client.ws.readyState === client.ws.OPEN) {
        client.ws.send(raw);
      }
    }
  }

  send(client: HubClient, event: ServerToClientEvent) {
    if (client.ws.readyState === client.ws.OPEN) {
      client.ws.send(JSON.stringify(event));
    }
  }

  mentorsOf(sessionId: string): HubClient[] {
    return [...(this.bySession.get(sessionId) ?? [])].filter((c) => c.role === 'mentor');
  }

  studentsOf(sessionId: string): HubClient[] {
    return [...(this.bySession.get(sessionId) ?? [])].filter((c) => c.role === 'student');
  }
}
