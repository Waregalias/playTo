# M3 WebSocket Infrastructure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the real-time backbone — an in-memory `ConnectionRegistry`, a `@fastify/websocket` `/ws` endpoint authenticated by the better-auth session cookie at upgrade, per-connection channel subscriptions (`global`, `region:{id}`, `character:{id}`), and an `app.realtime.publish(...)` decorator that services call after commit to fan events out to subscribers.

**Architecture:** The registry is a pure, framework-free class (two maps: channel→sockets and socket→channels) so it unit-tests without a live socket. The Fastify plugin owns only the transport: resolve the session, look up the character, subscribe the socket, clean up on close. Emission is decoupled — any service holding `app.realtime` calls `publish(channel, type, data, at)`; the registry serialises the `{channel,type,data,at}` envelope (shared `wsServerEventSchema`) and writes to each socket. No Redis, no external pub/sub (CLAUDE.md: one process, 50–200 players).

**Tech Stack:** Fastify 5, `@fastify/websocket` ^11 (bundles `ws`), better-auth, Vitest, `ws` client for the integration test.

## Global Constraints

- Le serveur fait autorité ; le client ne fait qu'émettre `chat.send` (plan chat) — aucune autre écriture via WS.
- Connexion `/ws` authentifiée par le cookie de session better-auth à l'upgrade ; non authentifié → fermeture (code 1008), jamais de canal ouvert anonyme.
- Émission **après commit** uniquement (ce plan fournit le mécanisme ; les producteurs d'événements arrivent aux plans chat/projets).
- Un process, en mémoire, pas de Redis (CLAUDE.md).
- Enveloppe serveur→client conforme API-SPEC §4 et à `wsServerEventSchema` (shared) : `{ channel, type, data, at }`.
- Canaux M3 : `global`, `region:{id}`, `character:{id}`. `mist.changed`/`warden.sighted`/`raid.*` hors périmètre.
- Vérif : `pnpm --filter api test`, `pnpm --filter api build` (= `tsc --noEmit`).
- `@fastify/websocket` est déjà installé (`apps/api/package.json`). `ws` (client de test) sera ajouté en devDependency.

---

### Task 1: `ConnectionRegistry` (pure in-memory)

**Files:**

- Create: `apps/api/src/realtime/registry.ts`
- Test: `apps/api/src/realtime/registry.test.ts`

**Interfaces:**

- Consumes: `WsServerEvent` from `@aldenfer/shared` (envelope type).
- Produces:

  ```ts
  export interface RealtimeSocket {
    send(data: string): void;
  }
  export class ConnectionRegistry {
    /** Subscribe a socket to the given channels (idempotent per channel). */
    add(socket: RealtimeSocket, channels: readonly string[]): void;
    /** Remove a socket from every channel it joined. */
    remove(socket: RealtimeSocket): void;
    /** Serialise a {channel,type,data,at} envelope and send it to every socket on `channel`. */
    publish(channel: string, type: string, data: unknown, at: string): void;
    /** Number of sockets currently subscribed to `channel` (test/introspection). */
    countChannel(channel: string): number;
  }
  ```

  A `send` that throws (dead socket) is swallowed so one bad socket never blocks the fan-out.

- [ ] **Step 1: Write the failing test**

`apps/api/src/realtime/registry.test.ts`:

```ts
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
    const payload = JSON.parse(a.send.mock.calls[0][0] as string);
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter api test registry`
Expected: FAIL — cannot resolve `./registry.js`.

- [ ] **Step 3: Implement the registry**

`apps/api/src/realtime/registry.ts`:

```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter api test registry`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/realtime/registry.ts apps/api/src/realtime/registry.test.ts
git commit -m "feat(api): in-memory WebSocket ConnectionRegistry

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: `/ws` plugin — auth upgrade, subscription, `app.realtime` decorator

**Files:**

- Create: `apps/api/src/realtime/plugin.ts`
- Test: `apps/api/src/realtime/plugin.test.ts`
- Modify: `apps/api/src/app.ts` (register the plugin; declare `app.realtime`)
- Modify: `apps/api/package.json` (add `ws` + `@types/ws` devDependencies for the test client)

**Interfaces:**

- Consumes: `ConnectionRegistry` (Task 1); `requireUser` from `../plugins/auth.js`; `characters` table; `app.auth`, `app.db`.
- Produces: `registerRealtime(app, auth): void` which decorates `app.realtime: ConnectionRegistry` and mounts `GET /ws`. A connection with no valid session is closed with code 1008 before any subscription. A valid session subscribes the socket to `global`, `region:{regionId}`, `character:{characterId}`.

- [ ] **Step 1: Add the `ws` client devDependency**

Run: `pnpm --filter api add -D ws @types/ws`
Expected: both added under devDependencies.

- [ ] **Step 2: Write the failing integration test**

`apps/api/src/realtime/plugin.test.ts` (mirrors the auth/signUp pattern from `modules/characters/routes.test.ts` — inspect it for the exact `signUp` helper and env/buildApp setup, and reuse them):

```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { WebSocket } from 'ws';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../app.js';
// ...import the same test env + signUp/createCharacter helpers used by other suites

let app: FastifyInstance;
let port: number;

beforeAll(async () => {
  app = await buildApp(/* test env, options */);
  await app.listen({ host: '127.0.0.1', port: 0 });
  port = (app.server.address() as { port: number }).port;
});

afterAll(async () => {
  await app.close();
});

function connect(cookie?: string): Promise<WebSocket> {
  const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`, cookie ? { headers: { cookie } } : {});
  return new Promise((resolve, reject) => {
    ws.on('open', () => resolve(ws));
    ws.on('error', reject);
    ws.on('close', (code) => reject(new Error(`closed ${code}`)));
  });
}

describe('/ws', () => {
  it('closes an unauthenticated connection with 1008', async () => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`);
    const code = await new Promise<number>((resolve) => ws.on('close', resolve));
    expect(code).toBe(1008);
  });

  it('delivers a broadcast to an authenticated subscriber', async () => {
    const cookie = await signUp('ws@aldenfer.test');
    await createCharacter(app, cookie, { name: 'Wsser', class: 'blade' }); // via inject
    const ws = await connect(cookie);
    const received = new Promise<string>((resolve) =>
      ws.on('message', (d) => resolve(d.toString())),
    );

    // give the server a tick to finish subscribing, then publish
    await new Promise((r) => setTimeout(r, 50));
    app.realtime.publish('global', 'announce', { msg: 'La cloche sonne' }, '2026-07-06T00:00:00Z');

    const event = JSON.parse(await received);
    expect(event).toMatchObject({
      channel: 'global',
      type: 'announce',
      data: { msg: 'La cloche sonne' },
    });
    ws.close();
  });
});
```

(Use `beforeAll`/`afterAll` — NOT `beforeEach` — because listening once per suite is enough. Reuse the project's real test DB/env exactly as the other API suites do.)

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm --filter api test plugin`
Expected: FAIL — `app.realtime` undefined / `/ws` route missing (unauth connection won't close with 1008 because there's no handler).

- [ ] **Step 4: Implement the plugin**

`apps/api/src/realtime/plugin.ts`:

```ts
import { eq } from 'drizzle-orm';
import fastifyWebsocket from '@fastify/websocket';
import type { FastifyInstance } from 'fastify';
import type { Auth } from '../auth.js';
import { characters } from '../db/schema.js';
import { requestHeaders } from '../plugins/auth.js';
import { ConnectionRegistry } from './registry.js';

declare module 'fastify' {
  interface FastifyInstance {
    realtime: ConnectionRegistry;
  }
}

export async function registerRealtime(app: FastifyInstance, auth: Auth): Promise<void> {
  const registry = new ConnectionRegistry();
  app.decorate('realtime', registry);

  await app.register(fastifyWebsocket);

  app.register(async (scoped) => {
    scoped.get('/ws', { websocket: true }, async (socket, request) => {
      const session = await auth.api.getSession({ headers: requestHeaders(request) });
      if (!session) {
        socket.close(1008, 'UNAUTHENTICATED');
        return;
      }
      const character = await app.db.query.characters.findFirst({
        where: eq(characters.userId, session.user.id),
      });
      if (!character) {
        socket.close(1008, 'NO_CHARACTER');
        return;
      }
      registry.add(socket, ['global', `region:${character.regionId}`, `character:${character.id}`]);
      socket.on('close', () => registry.remove(socket));
    });
  });
}
```

Note on the `@fastify/websocket` v11 handler signature: the first argument is the raw `WebSocket` (which has `.send`/`.close`/`.on`), the second is the `FastifyRequest`. If the installed version passes `(connection, request)` with `connection.socket`, adapt to `const socket = connection.socket ?? connection;` — verify against `node_modules/@fastify/websocket` types before finalising.

Wire it in `apps/api/src/app.ts`:

- Import: `import { registerRealtime } from './realtime/plugin.js';`
- Add `realtime` is declared inside the plugin's `declare module`, so no change to the existing `declare module` block in app.ts is needed.
- After the other `register*Routes(...)` calls, add: `await registerRealtime(app, auth);`

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm --filter api test plugin`
Expected: PASS (2 tests). If the unauth case hangs, confirm the handler runs `socket.close(1008)` synchronously before any await that could reject.

- [ ] **Step 6: Full suite, typecheck & commit**

Run: `pnpm --filter api test` — Expected: all pass (existing inject suites unaffected by adding a WS route).
Run: `pnpm --filter api build` — Expected: no errors.

```bash
git add apps/api/src/realtime/plugin.ts apps/api/src/realtime/plugin.test.ts apps/api/src/app.ts apps/api/package.json
git commit -m "feat(api): /ws endpoint — session-authed upgrade, channel subscriptions

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Self-Review

**Spec coverage (SPEC-M3 step 3 = api WS):**

- Plugin `@fastify/websocket` → Task 2. ✅
- `ConnectionRegistry` in-memory → Task 1. ✅
- Auth at upgrade (401/close for unauth) → Task 2 (1008 close). ✅
- Channel subscription `global`/`region:{id}`/`character:{id}` → Task 2. ✅
- Emit mechanism (`app.realtime.publish`) for post-commit fan-out → Tasks 1+2. ✅
- Producers of events (chat.message, project.progress, action.resolved…) → deferred to their own plans (chat, projects), which call `app.realtime.publish`. Correctly out of scope here.

**Placeholder scan:** The integration test references `signUp`/`createCharacter`/test-env setup "as in the other suites" — Step 2 instructs to inspect and reuse the concrete helpers; the assertions (close code 1008, envelope match) are concrete. The v11 handler-signature note is a real verification step, not a placeholder. ✅

**Type consistency:** `ConnectionRegistry.publish(channel,type,data,at)` (Task 1) is exactly what the plugin and future services call; the emitted object matches shared `WsServerEvent`/`wsServerEventSchema` `{channel,type,data,at}`. `app.realtime: ConnectionRegistry` declared once (in plugin.ts). ✅

## Notes for subsequent M3 plans

- Plan « chat » adds the client→server `chat.send` handling (parse `wsClientMessageSchema`, rate-limit 10/min, persist, then `app.realtime.publish('<channel>', 'chat.message', dto, at)`), plus `GET /chat/:channel` history.
- Plan « projets/contributions » calls `app.realtime.publish('region:1', 'project.progress', ..., at)` (throttled 10 s) after each contribution commit, and `publish('global', 'announce', ...)` on belfry completion.
- Existing resolution paths (actions/quests/level-up) will publish on `character:{id}` in a later wiring pass.
