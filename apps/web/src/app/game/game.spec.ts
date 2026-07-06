import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import type { CharacterDto } from '@aldenfer/shared';
import { GameComponent } from './game';
import { ApiClient } from '../core/api-client';
import { GameStore } from '../core/game-store';

const CHARACTER: CharacterDto = {
  id: '4dfc1f88-0000-4000-8000-000000000001',
  name: 'Serelle',
  class: 'blade',
  level: 1,
  xp: 0,
  xpNext: 100,
  attributes: { str: 8, dex: 5, wil: 4, vit: 9, fer: 4 },
  attributePoints: 0,
  skillPoints: 0,
  hp: 102,
  hpMax: 102,
  stamina: 72,
  staminaMax: 100,
  deathPenaltyUntil: null,
  hexId: '4dfc1f88-0000-4000-8000-000000000002',
  regionId: 0,
  currencies: { ashCrowns: 0, emberFragments: 0, gloryMarks: 0 },
};

async function settle(fixture: { detectChanges(): void }): Promise<void> {
  // let the ngOnInit promise chain (load → Promise.all) fully settle
  await new Promise((resolve) => setTimeout(resolve));
  fixture.detectChanges();
}

describe('GameComponent', () => {
  const apiMock = {
    getMe: vi.fn(),
    getActions: vi.fn(),
    getRegions: vi.fn(),
    getRegionHexes: vi.fn(),
    postAction: vi.fn(),
    cancelAction: vi.fn(),
    createCharacter: vi.fn(),
    getCurrentCombat: vi.fn(),
    getQuests: vi.fn(),
    getInventory: vi.fn(),
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    apiMock.getActions.mockResolvedValue([]);
    apiMock.getRegions.mockResolvedValue([]);
    apiMock.getRegionHexes.mockResolvedValue([]);
    apiMock.getCurrentCombat.mockResolvedValue(null);
    apiMock.getQuests.mockResolvedValue([]);
    apiMock.getInventory.mockResolvedValue({ items: [], capacity: 30, used: 0 });
    await TestBed.configureTestingModule({
      imports: [GameComponent],
      providers: [provideRouter([]), { provide: ApiClient, useValue: apiMock }, GameStore],
    }).compileComponents();
  });

  it('affiche la création de personnage quand le compte n’a pas de Ravivé', async () => {
    apiMock.getMe.mockResolvedValue(null);
    const fixture = TestBed.createComponent(GameComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('app-character-creation')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('[data-testid="statusbar"]')).toBeNull();
  });

  it('affiche le shell (statut, file vide, nav) quand le personnage existe', async () => {
    apiMock.getMe.mockResolvedValue(CHARACTER);
    const fixture = TestBed.createComponent(GameComponent);
    fixture.detectChanges();
    await settle(fixture);

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('[data-testid="statusbar"]')?.textContent).toContain('Serelle');
    expect(el.querySelector('[data-testid="queuebar"]')?.textContent).toContain(
      'la flammèche attend',
    );
    expect(el.querySelectorAll('nav button')).toHaveLength(4);
  });

  it('affiche le compte à rebours de l’action en cours', async () => {
    apiMock.getMe.mockResolvedValue(CHARACTER);
    apiMock.getActions.mockResolvedValue([
      {
        id: '4dfc1f88-0000-4000-8000-000000000003',
        type: 'move',
        payload: {},
        position: 0,
        startsAt: new Date().toISOString(),
        endsAt: new Date(Date.now() + 90_000).toISOString(),
        resolved: false,
      },
    ]);
    const fixture = TestBed.createComponent(GameComponent);
    fixture.detectChanges();
    await settle(fixture);

    const queuebar = fixture.nativeElement.querySelector('[data-testid="queuebar"]');
    expect(queuebar?.textContent).toContain('Déplacement');
    expect(queuebar?.textContent).toMatch(/1:\d{2}/);
  });
});
