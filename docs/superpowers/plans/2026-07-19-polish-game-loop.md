# Polish Game Loop — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Solidify the existing game experience — notifications, belfry unlock, loading skeleton, responsive fixes — before adding new content.

**Architecture:** Four independent frontend tasks touching `RealtimeService` (toast on WS events), `BastionScreenComponent` (dynamic belfry unlock from project state), `GameComponent` (skeleton loading), and SCSS fixes (360px responsive). All changes are frontend-only. French UI strings go in `packages/shared/src/content/fr/ui.ts`. PWA is already configured (manifest, icons, ngsw, provideServiceWorker) — no work needed.

**Tech Stack:** Angular 22 (standalone, signals), SCSS, vitest (via `pnpm --filter web test`)

## Global Constraints

- Code 100% English (identifiers, comments). French player-facing strings live in `packages/shared/src/content/fr/ui.ts` as part of `UI_FR`.
- CSS uses `--g-*` custom properties from DESIGN.md. Ember color = rare, meaningful.
- Touch targets ≥ 44px. `prefers-reduced-motion` respected.
- Single responsive breakpoint: `@media (min-width: 1024px)` via `@use '../layout'; @include layout.wide { }`.
- Tests run with: `pnpm --filter web test` (vitest + Angular TestBed).

---

### Task 1: In-game notification toasts on WS events

When the server pushes `action.resolved`, `level.up`, `stamina.full`, `quest.updated`, or `project.progress` via WebSocket, the player should see a toast message. Currently `RealtimeService.handleFrame()` triggers store refreshes silently.

**Files:**
- Modify: `packages/shared/src/content/fr/ui.ts` (add `notifications` block to `UI_FR`)
- Modify: `apps/web/src/app/core/realtime.ts` (inject `ToastService`, show toast in `handleFrame`)
- Modify: `apps/web/src/app/core/realtime.spec.ts` (add toast expectation to existing tests + new test)

**Interfaces:**
- Consumes: `ToastService.show(message: string): void`, `UI_FR` from `@aldenfer/shared/content/fr`
- Produces: toast shown on every game WS event (visible to player)

- [ ] **Step 1: Add notification strings to `ui.ts`**

In `packages/shared/src/content/fr/ui.ts`, add a `notifications` property to `UI_FR` (after the `bastion` block, before the closing `}`):

```typescript
  notifications: {
    actionResolved: 'Action terminée.',
    levelUp: 'Niveau supérieur !',
    staminaFull: 'Endurance restaurée.',
    questUpdated: 'Quête mise à jour.',
    projectProgress: 'Contribution enregistrée.',
  },
```

- [ ] **Step 2: Write the failing test**

In `apps/web/src/app/core/realtime.spec.ts`, add a `ToastService` mock to the `beforeEach` providers and a new test:

Add to the `beforeEach` block, after the existing `storeMock` declaration:

```typescript
let toastMock: { show: ReturnType<typeof vi.fn>; message: ReturnType<typeof vi.fn> };
```

Initialize it inside `beforeEach`, before `TestBed.configureTestingModule`:

```typescript
toastMock = { show: vi.fn(), message: vi.fn(() => null) };
```

Add the `ToastService` import at the top of the file:

```typescript
import { ToastService } from './toast';
```

Add to the `providers` array inside `TestBed.configureTestingModule`:

```typescript
{ provide: ToastService, useValue: toastMock },
```

Add the new test inside the `describe('RealtimeService', ...)` block:

```typescript
  it('shows a toast notification on action.resolved', () => {
    const service = TestBed.inject(RealtimeService);
    service.connect();
    sockets[0].emitOpen();
    toastMock.show.mockClear();
    sockets[0].emitMessage({ channel: 'character:c1', type: 'action.resolved', data: {}, at: '' });
    expect(toastMock.show).toHaveBeenCalledWith('Action terminée.');
  });

  it('shows a toast notification on level.up', () => {
    const service = TestBed.inject(RealtimeService);
    service.connect();
    sockets[0].emitOpen();
    toastMock.show.mockClear();
    sockets[0].emitMessage({ channel: 'character:c1', type: 'level.up', data: {}, at: '' });
    expect(toastMock.show).toHaveBeenCalledWith('Niveau supérieur !');
  });

  it('does not show a toast for chat.message or announce', () => {
    const service = TestBed.inject(RealtimeService);
    service.connect();
    sockets[0].emitOpen();
    toastMock.show.mockClear();
    sockets[0].emitMessage({ channel: 'global', type: 'chat.message', data: { id: 'm1', channel: 'global', characterId: 'c1', characterName: 'X', body: 'hi', at: '' }, at: '' });
    sockets[0].emitMessage({ channel: 'global', type: 'announce', data: { kind: 'test' }, at: '' });
    expect(toastMock.show).not.toHaveBeenCalled();
  });
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm --filter web test -- --run realtime.spec`

Expected: FAIL — `ToastService` not injected in `RealtimeService`, `show` never called.

- [ ] **Step 4: Implement toast notifications in `RealtimeService`**

In `apps/web/src/app/core/realtime.ts`:

1. Add imports at the top:

```typescript
import { UI_FR } from '@aldenfer/shared/content/fr';
import { ToastService } from './toast';
```

2. Add injection in the `RealtimeService` class, after the existing `wsFactory` injection:

```typescript
  private readonly toast = inject(ToastService);
```

3. Add a private helper method after `handleFrame`:

```typescript
  private notificationMessage(type: string): string | null {
    const n = UI_FR.notifications;
    switch (type) {
      case 'action.resolved': return n.actionResolved;
      case 'level.up': return n.levelUp;
      case 'stamina.full': return n.staminaFull;
      case 'quest.updated': return n.questUpdated;
      case 'project.progress': return n.projectProgress;
      default: return null;
    }
  }
```

4. In `handleFrame`, add the toast call right before the existing `refreshActionFor` call (after the `announce` early return, before `const action = refreshActionFor(event.type);`):

```typescript
    const msg = this.notificationMessage(event.type);
    if (msg) this.toast.show(msg);
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm --filter web test -- --run realtime.spec`

Expected: all tests PASS (existing + new toast tests).

- [ ] **Step 6: Commit**

```bash
git add packages/shared/src/content/fr/ui.ts apps/web/src/app/core/realtime.ts apps/web/src/app/core/realtime.spec.ts
git commit -m "feat(web): show toast notifications on WS game events"
```

---

### Task 2: Belfry dynamic unlock on project completion

The belfry building in the Bastion is hardcoded as locked (`opens: null`). When the community project `r1.belfry` is completed (`completedAt` is set), the belfry should visually unlock and be enterable. Since raids are not yet implemented (M4), clicking the unlocked belfry shows a placeholder view.

**Files:**
- Modify: `packages/shared/src/content/fr/ui.ts` (add belfry completion message)
- Modify: `apps/web/src/app/core/game-store.ts` (add `refreshProject()` to `load()`)
- Modify: `apps/web/src/app/game/bastion/bastion-screen.ts` (dynamic `opens` for belfry in computed)
- Modify: `apps/web/src/app/game/bastion/bastion-screen.html` (add `@case ('belfry')` view)
- Modify: `apps/web/src/app/game/bastion/bastion-screen.spec.ts` (test dynamic unlock)

**Interfaces:**
- Consumes: `GameStore.currentProject()` → `ProjectDetailDto | null` (has `completedAt: string | null`), `GameStore.refreshProject(): Promise<void>`
- Produces: belfry building dynamically unlocked when `currentProject()?.completedAt` is truthy

- [ ] **Step 1: Add belfry placeholder string to `ui.ts`**

In `packages/shared/src/content/fr/ui.ts`, add to the `bastion` block:

```typescript
    belfryTeaser: 'Le beffroi a sonné le Glas. Les raids ouvriront bientôt leurs portes.',
```

- [ ] **Step 2: Add `refreshProject()` to `GameStore.load()`**

In `apps/web/src/app/core/game-store.ts`, add `this.refreshProject()` to the `Promise.all` inside `load()`. Change line 62-67 from:

```typescript
    await Promise.all([
      this.refreshActions(),
      this.refreshHexes(),
      this.refreshQuests(),
      this.refreshInventory(),
    ]);
```

to:

```typescript
    await Promise.all([
      this.refreshActions(),
      this.refreshHexes(),
      this.refreshQuests(),
      this.refreshInventory(),
      this.refreshProject(),
    ]);
```

- [ ] **Step 3: Write the failing test for dynamic belfry unlock**

In `apps/web/src/app/game/bastion/bastion-screen.spec.ts`, add a test that verifies the belfry building's `opens` reflects project completion. The test needs a `GameStore` mock with `currentProject` as a writable signal.

First, read the existing spec file to understand its test setup. Then add:

```typescript
  it('unlocks the belfry building when the project is completed', () => {
    // Set up: currentProject has completedAt
    storeMock.currentProject.set({ id: 'r1.belfry', completedAt: '2026-07-01T00:00:00Z' } as any);
    fixture.detectChanges();
    const belfry = component.buildings().find(b => b.id === 'building.belfry');
    expect(belfry?.opens).toBe('belfry');
  });

  it('keeps the belfry locked when the project is not completed', () => {
    storeMock.currentProject.set({ id: 'r1.belfry', completedAt: null } as any);
    fixture.detectChanges();
    const belfry = component.buildings().find(b => b.id === 'building.belfry');
    expect(belfry?.opens).toBeNull();
  });
```

Note: adapt the mock setup to match the existing spec's `storeMock` shape. The `currentProject` signal must be a writable signal in the mock (use `signal()` from `@angular/core`).

- [ ] **Step 4: Run test to verify it fails**

Run: `pnpm --filter web test -- --run bastion-screen.spec`

Expected: FAIL — belfry `opens` is always `null`.

- [ ] **Step 5: Implement dynamic belfry unlock**

In `apps/web/src/app/game/bastion/bastion-screen.ts`:

1. Update the `View` type to include `'belfry'`:

```typescript
type View = 'home' | 'quests' | 'project' | 'market' | 'belfry';
```

2. In the `buildings` computed signal (line 78-88), make the belfry `opens` dynamic. Replace the existing computed body:

```typescript
  readonly buildings = computed<BuildingVm[]>(() => {
    const activeQuests = this.store.quests().filter((q) => q.state === 'active').length;
    const belfryDone = !!this.store.currentProject()?.completedAt;
    return this.buildingDefs.map((def) => ({
      id: def.id,
      name: BUILDINGS_FR[def.id].name,
      description: BUILDINGS_FR[def.id].description,
      icon: def.icon,
      opens: def.id === 'building.belfry' && belfryDone ? 'belfry' : def.opens,
      badge: def.id === 'building.board' && activeQuests > 0 ? activeQuests : null,
    }));
  });
```

- [ ] **Step 6: Add belfry view to the template**

In `apps/web/src/app/game/bastion/bastion-screen.html`, find the `@switch (view())` block and add a `@case ('belfry')` before the closing `}`:

```html
    @case ('belfry') {
      <button class="btn back" (click)="view.set('home')">{{ tBastion.back }}</button>
      <div class="card">
        <h3>{{ store.currentProject()?.name }}</h3>
        <p class="muted hint">{{ tBastion.belfryTeaser }}</p>
      </div>
    }
```

- [ ] **Step 7: Run test to verify it passes**

Run: `pnpm --filter web test -- --run bastion-screen.spec`

Expected: all tests PASS.

- [ ] **Step 8: Commit**

```bash
git add packages/shared/src/content/fr/ui.ts apps/web/src/app/core/game-store.ts apps/web/src/app/game/bastion/bastion-screen.ts apps/web/src/app/game/bastion/bastion-screen.html apps/web/src/app/game/bastion/bastion-screen.spec.ts
git commit -m "feat(web): unlock belfry building when community project completes"
```

---

### Task 3: Skeleton loading state

The game shell shows an empty `<div class="loading">` while `store.loaded()` is false. Add an ember-pulsing skeleton with the game title to give visual feedback during initial load.

**Files:**
- Modify: `apps/web/src/app/game/game.html` (replace empty div with skeleton markup)
- Modify: `apps/web/src/app/game/game.scss` (style the skeleton)

**Interfaces:**
- Consumes: `store.loaded()` signal (boolean), already wired in `game.html` line 2
- Produces: visible pulsing skeleton during initial load

- [ ] **Step 1: Replace empty loading div with skeleton markup**

In `apps/web/src/app/game/game.html`, replace line 3:

```html
    <div class="loading" aria-busy="true"></div>
```

with:

```html
    <div class="loading" aria-busy="true">
      <div class="loading-ember"></div>
      <span class="loading-title">Aldenfer</span>
    </div>
```

- [ ] **Step 2: Style the skeleton in `game.scss`**

In `apps/web/src/app/game/game.scss`, replace the existing `.loading` rule (line 43):

```scss
.loading { flex: 1; }
```

with:

```scss
.loading {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
}

.loading-ember {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: radial-gradient(circle, var(--g-ember) 30%, transparent 70%);
  animation: ember-pulse 2.4s ease-in-out infinite;
}

.loading-title {
  font-family: var(--g-font-display);
  font-size: 1.25rem;
  letter-spacing: 0.12em;
  color: var(--g-mist);
}

@keyframes ember-pulse {
  0%, 100% { opacity: 0.4; transform: scale(0.85); }
  50% { opacity: 1; transform: scale(1); }
}

@media (prefers-reduced-motion: reduce) {
  .loading-ember { animation: none; opacity: 0.7; }
}
```

- [ ] **Step 3: Verify visually**

Start the dev server with `pnpm dev`. Open `http://localhost:4200/game` in the browser preview. Throttle network to Slow 3G in DevTools to see the skeleton during load. Verify:
- Ember circle pulses centered on screen
- "Aldenfer" text in Cinzel font below it
- `prefers-reduced-motion` disables the pulsing
- Skeleton disappears once data loads

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/game/game.html apps/web/src/app/game/game.scss
git commit -m "feat(web): add ember-pulse skeleton loading state"
```

---

### Task 4: Responsive fixes at 360px

Verify hero screen and bastion screen at 360px viewport width. Fix any overflow, truncation, or touch-target issues.

**Files:**
- Modify: `apps/web/src/app/game/hero/hero-screen.scss` (responsive fixes)
- Modify: `apps/web/src/app/game/bastion/bastion-screen.scss` (responsive fixes if needed)
- Modify: `apps/web/src/app/game/game.scss` (status bar fixes if needed)

**Interfaces:**
- Consumes: existing component markup (no HTML changes expected)
- Produces: all game screens render without horizontal overflow at 360px

- [ ] **Step 1: Audit at 360px**

Start the dev server. Open `http://localhost:4200/game/hero` in the browser preview. Resize the viewport to 360x640 (mobile preset or custom). Take a screenshot. Check for:
- Horizontal overflow on any element
- Status bar elements overflowing or wrapping badly
- Hero portrait + identity cramped
- Stat grid (5 columns) cells too narrow for content
- Inventory grid cells below 44px
- Button text truncated
- Any text unreadable at that width

Then navigate to `/game/bastion` and repeat.

- [ ] **Step 2: Fix hero screen issues**

Known risk areas in `apps/web/src/app/game/hero/hero-screen.scss`:

1. **Portrait width**: `.portrait` is `width: 42%` — at 360px with 14px padding each side = 332px usable, 42% = 139px. This is tight but acceptable for a 3:4 aspect ratio. If it looks cramped, reduce to `width: 36%`.

2. **Stat grid**: `.statgrid` uses `repeat(5, 1fr)` — at 332px with 8px gaps = ~58px per cell. The abbreviations (FOR/ADR/VOL/VIT/FER) are 3 chars, fine. But the `+` allocation button might be tight. If needed, reduce gap to 6px:

```scss
.statgrid {
  gap: 6px;
}
```

3. **Gauge row**: `.gaugerow` uses `grid-template-columns: 84px 1fr auto`. The 84px label might push the bar too narrow. If so, reduce to 72px:

```scss
.gaugerow {
  grid-template-columns: 72px 1fr auto;
}
```

Apply only the fixes that are actually needed based on the visual audit in Step 1.

- [ ] **Step 3: Fix status bar overflow**

In `apps/web/src/app/game/game.scss`, the status bar (`.statusbar`) packs avatar + name + gauges + purse + iconbar into a flex row. At 360px this is very tight. If the purse or iconbar wraps or overflows:

1. Hide the `.who` block on very narrow screens:

```scss
@media (max-width: 400px) {
  .who { display: none; }
}
```

2. Or reduce purse font size and gap:

```scss
@media (max-width: 400px) {
  .purse { gap: 6px; font-size: 0.72rem; }
}
```

Apply only what the visual audit reveals.

- [ ] **Step 4: Verify fixes at 360px**

Resize back to 360x640 in the browser preview. Navigate through all tabs (map, bastion, hero, raid). Verify:
- No horizontal scrollbar on any screen
- All touch targets ≥ 44px
- Text is readable (not clipped or overlapping)
- Gauges show their labels

Take final screenshot as proof.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/game/hero/hero-screen.scss apps/web/src/app/game/bastion/bastion-screen.scss apps/web/src/app/game/game.scss
git commit -m "fix(web): responsive layout fixes for 360px mobile viewport"
```

---

## Notes

**PWA is already configured** — no implementation needed:
- `apps/web/public/manifest.webmanifest` exists with 8 icon sizes
- `apps/web/public/icons/` contains all referenced PNGs
- `apps/web/ngsw-config.json` configures app shell + lazy asset caching
- `apps/web/src/app/app.config.ts` registers `provideServiceWorker('ngsw-worker.js', { enabled: !isDevMode() })`
- `apps/web/src/index.html` has `<link rel="manifest" href="manifest.webmanifest" />`

To verify PWA: run `pnpm --filter web build`, serve the `dist/` output with a static server, and run Lighthouse PWA audit.
