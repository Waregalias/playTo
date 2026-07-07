import type { WsServerEvent } from '@aldenfer/shared';

export interface RealtimeSocket {
  send(data: string): void;
}

/** In-memory pub/sub for WebSocket fan-out. One instance per process (CLAUDE.md). */
export class ConnectionRegistry {
  private readonly byChannel = new Map<string, Set<RealtimeSocket>>();
  private readonly bySocket = new Map<RealtimeSocket, Set<string>>();

  add(socket: RealtimeSocket, channels: readonly string[]): void {
    let joined = this.bySocket.get(socket);
    if (!joined) {
      joined = new Set();
      this.bySocket.set(socket, joined);
    }
    for (const channel of channels) {
      joined.add(channel);
      let subscribers = this.byChannel.get(channel);
      if (!subscribers) {
        subscribers = new Set();
        this.byChannel.set(channel, subscribers);
      }
      subscribers.add(socket);
    }
  }

  remove(socket: RealtimeSocket): void {
    const joined = this.bySocket.get(socket);
    if (!joined) return;
    for (const channel of joined) {
      const subscribers = this.byChannel.get(channel);
      if (!subscribers) continue;
      subscribers.delete(socket);
      if (subscribers.size === 0) this.byChannel.delete(channel);
    }
    this.bySocket.delete(socket);
  }

  publish(channel: string, type: string, data: unknown, at: string): void {
    const subscribers = this.byChannel.get(channel);
    if (!subscribers || subscribers.size === 0) return;
    const event: WsServerEvent = { channel, type, data, at };
    const frame = JSON.stringify(event);
    for (const socket of subscribers) {
      try {
        socket.send(frame);
      } catch {
        // A dead socket must not block the rest of the fan-out; cleanup happens on 'close'.
      }
    }
  }

  countChannel(channel: string): number {
    return this.byChannel.get(channel)?.size ?? 0;
  }
}
