import { describe, it, expect, vi } from 'vitest';
import { ConnectionRegistry, type RealtimeSocket } from './registry.js';

function fakeSocket() {
  return { send: vi.fn() } satisfies RealtimeSocket;
}

describe('ConnectionRegistry', () => {
  it('publishes only to sockets subscribed to the channel', () => {
    const reg = new ConnectionRegistry();
    const a = fakeSocket();
    const b = fakeSocket();
    reg.add(a, ['global', 'region:1']);
    reg.add(b, ['global']);

    reg.publish('region:1', 'chat.message', { body: 'hi' }, '2026-07-06T00:00:00Z');

    expect(a.send).toHaveBeenCalledTimes(1);
    expect(b.send).not.toHaveBeenCalled();
    const payload = JSON.parse(a.send.mock.calls[0]![0] as string);
    expect(payload).toEqual({
      channel: 'region:1',
      type: 'chat.message',
      data: { body: 'hi' },
      at: '2026-07-06T00:00:00Z',
    });
  });

  it('counts subscribers and removes a socket from all channels', () => {
    const reg = new ConnectionRegistry();
    const a = fakeSocket();
    reg.add(a, ['global', 'region:1', 'character:x']);
    expect(reg.countChannel('global')).toBe(1);

    reg.remove(a);
    expect(reg.countChannel('global')).toBe(0);
    expect(reg.countChannel('region:1')).toBe(0);
    reg.publish('global', 'announce', {}, '2026-07-06T00:00:00Z');
    expect(a.send).not.toHaveBeenCalled();
  });

  it('keeps fanning out when one socket throws', () => {
    const reg = new ConnectionRegistry();
    const bad = {
      send: vi.fn(() => {
        throw new Error('dead');
      }),
    } satisfies RealtimeSocket;
    const good = fakeSocket();
    reg.add(bad, ['global']);
    reg.add(good, ['global']);

    expect(() => reg.publish('global', 'announce', {}, '2026-07-06T00:00:00Z')).not.toThrow();
    expect(good.send).toHaveBeenCalledTimes(1);
  });

  it('does nothing for an empty channel', () => {
    const reg = new ConnectionRegistry();
    expect(() => reg.publish('region:9', 'announce', {}, '2026-07-06T00:00:00Z')).not.toThrow();
    expect(reg.countChannel('region:9')).toBe(0);
  });
});
