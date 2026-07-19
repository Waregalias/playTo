import { TestBed } from '@angular/core/testing';
import type { CharacterDto, InventoryEntryDto } from '@aldenfer/shared';
import { HeroScreenComponent } from './hero-screen';
import { ApiClient } from '../../core/api-client';
import { GameStore } from '../../core/game-store';

const CHARACTER: CharacterDto = {
  id: 'c1',
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
  hexId: 'h1',
  regionId: 0,
  currencies: { ashCrowns: 50, emberFragments: 0, gloryMarks: 0 },
  skills: [],
};

function makeEntry(overrides: Partial<InventoryEntryDto>): InventoryEntryDto {
  return {
    id: 'e1',
    itemId: 'weapon.blade.t1',
    kind: 'weapon',
    rarity: 'common',
    qty: 1,
    equipped: true,
    stats: { power: 6 },
    durability: 100,
    maxDurability: 100,
    ...overrides,
  };
}

describe('HeroScreenComponent — durability & repair', () => {
  const apiMock = { repairEntry: vi.fn() };
  let storeMock: {
    character: ReturnType<typeof vi.fn>;
    inventory: ReturnType<typeof vi.fn>;
    refreshInventory: ReturnType<typeof vi.fn>;
    refresh: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    storeMock = {
      character: vi.fn(() => CHARACTER),
      inventory: vi.fn(() => ({ items: [makeEntry({ durability: 60 })], capacity: 30, used: 1 })),
      refreshInventory: vi.fn().mockResolvedValue(undefined),
      refresh: vi.fn().mockResolvedValue(undefined),
    };
    await TestBed.configureTestingModule({
      imports: [HeroScreenComponent],
      providers: [
        { provide: ApiClient, useValue: apiMock },
        { provide: GameStore, useValue: storeMock },
      ],
    }).compileComponents();
  });

  it('shows the equipped weapon in its slot with durability and a repair button when damaged', () => {
    const fixture = TestBed.createComponent(HeroScreenComponent);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('[data-testid="slot-weapon"]')?.textContent).toContain('60 / 100');
    expect(el.querySelector('[data-testid="repair-e1"]')).toBeTruthy();
  });

  it('hides the repair button when the item is at full durability', () => {
    storeMock.inventory = vi.fn(() => ({
      items: [makeEntry({ durability: 100 })],
      capacity: 30,
      used: 1,
    }));
    const fixture = TestBed.createComponent(HeroScreenComponent);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('[data-testid="repair-e1"]')).toBeNull();
  });

  it('lists an unequipped item in the inventory grid and reveals actions on select', () => {
    storeMock.inventory = vi.fn(() => ({
      items: [makeEntry({ equipped: false })],
      capacity: 30,
      used: 1,
    }));
    const fixture = TestBed.createComponent(HeroScreenComponent);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const cell = el.querySelector<HTMLButtonElement>('[data-testid="item-weapon.blade.t1"]');
    expect(cell).toBeTruthy();
    expect(el.querySelector('[data-testid="slot-weapon"]')?.textContent).toContain('—');
    cell?.click();
    fixture.detectChanges();
    expect(el.querySelector('[data-testid="item-actions"]')).toBeTruthy();
  });

  it('calls repairEntry and refreshes inventory + character', async () => {
    apiMock.repairEntry.mockResolvedValue({ character: CHARACTER, entry: makeEntry({ durability: 100 }) });
    const fixture = TestBed.createComponent(HeroScreenComponent);
    fixture.detectChanges();
    await fixture.componentInstance.repair('e1');
    expect(apiMock.repairEntry).toHaveBeenCalledWith('e1');
    expect(storeMock.refreshInventory).toHaveBeenCalled();
    expect(storeMock.refresh).toHaveBeenCalled();
  });
});
