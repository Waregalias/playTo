import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest';
import { WebSocket } from 'ws';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../app.js';
import { setupTestDb, resetTestDb, TEST_ENV } from '../test/test-db.js';
import type { Db } from '../db/client.js';

let app: FastifyInstance;
let db: Db;
let port: number;

const NOW = new Date('2026-07-04T12:00:00Z');

async function signUp(email: string): Promise<string> {
  const response = await app.inject({
    method: 'POST',
    url: '/api/auth/sign-up/email',
    payload: { email, password: 'motdepasse-solide', name: email.split('@')[0] },
  });
  expect(response.statusCode).toBe(200);
  const cookies = response.headers['set-cookie'];
  return (Array.isArray(cookies) ? cookies : [cookies])
    .filter(Boolean)
    .map((c) => String(c).split(';')[0])
    .join('; ');
}

async function createCharacter(cookie: string): Promise<void> {
  const res = await app.inject({
    method: 'POST',
    url: '/api/v1/characters',
    headers: { cookie },
    payload: { name: 'Wsser', class: 'blade' },
  });
  expect(res.statusCode).toBe(201);
}

/** Opens a ws connection and resolves once it is open (or rejects on early error). */
function open(cookie?: string): Promise<WebSocket> {
  const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`, cookie ? { headers: { cookie } } : {});
  return new Promise((resolve, reject) => {
    ws.on('open', () => resolve(ws));
    ws.on('error', reject);
  });
}

beforeAll(async () => {
  db = await setupTestDb();
  app = await buildApp(TEST_ENV, { db, now: () => NOW });
  await app.listen({ host: '127.0.0.1', port: 0 });
  port = (app.server.address() as { port: number }).port;
});
afterAll(async () => {
  await app.close();
});
beforeEach(async () => {
  await resetTestDb(db);
});

describe('/ws', () => {
  it('closes an unauthenticated connection with 1008', async () => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`);
    const code = await new Promise<number>((resolve, reject) => {
      ws.on('close', (c) => resolve(c));
      ws.on('error', reject);
    });
    expect(code).toBe(1008);
  });

  it('delivers a broadcast to an authenticated subscriber', async () => {
    const cookie = await signUp('ws@aldenfer.test');
    await createCharacter(cookie);
    const ws = await open(cookie);
    const received = new Promise<string>((resolve) =>
      ws.on('message', (d: Buffer) => resolve(d.toString())),
    );

    await vi.waitFor(() => expect(app.realtime.countChannel('global')).toBeGreaterThan(0));
    app.realtime.publish('global', 'announce', { msg: 'La cloche sonne' }, '2026-07-06T00:00:00Z');

    const event = JSON.parse(await received);
    expect(event).toMatchObject({
      channel: 'global',
      type: 'announce',
      data: { msg: 'La cloche sonne' },
    });
    ws.close();
  });

  it('persists and broadcasts a chat.send as chat.message', async () => {
    const cookie = await signUp('sender@aldenfer.test');
    await createCharacter(cookie);
    const ws = await open(cookie);
    await vi.waitFor(() => expect(app.realtime.countChannel('global')).toBeGreaterThan(0));

    const got = new Promise<{
      type: string;
      channel: string;
      data: { body: string; characterName: string };
    }>((resolve) => ws.on('message', (d: Buffer) => resolve(JSON.parse(d.toString()))));
    ws.send(JSON.stringify({ type: 'chat.send', channel: 'global', body: 'ohé le bastion' }));

    const event = await got;
    expect(event.type).toBe('chat.message');
    expect(event.channel).toBe('global');
    expect(event.data.body).toBe('ohé le bastion');
    expect(event.data.characterName).toBe('Wsser');

    const hist = await app.inject({
      method: 'GET',
      url: '/api/v1/chat/global',
      headers: { cookie },
    });
    expect(hist.json().items[0].body).toBe('ohé le bastion');
    ws.close();
  });

  it('emits chat.throttled past 10 messages per minute', async () => {
    const cookie = await signUp('flood@aldenfer.test');
    await createCharacter(cookie);
    const ws = await open(cookie);
    await vi.waitFor(() => expect(app.realtime.countChannel('global')).toBeGreaterThan(0));

    const frames: { type: string }[] = [];
    ws.on('message', (d: Buffer) => frames.push(JSON.parse(d.toString())));
    for (let i = 0; i < 12; i++) {
      ws.send(JSON.stringify({ type: 'chat.send', channel: 'global', body: `m${i}` }));
    }

    await vi.waitFor(() =>
      expect(frames.filter((f) => f.type === 'chat.throttled').length).toBeGreaterThan(0),
    );
    expect(frames.filter((f) => f.type === 'chat.message').length).toBe(10);
    ws.close();
  });
});
