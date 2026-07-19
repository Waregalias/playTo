import { TestBed } from '@angular/core/testing';
import { BastionScreenComponent } from './bastion-screen';
import { ApiClient } from '../../core/api-client';
import { GameStore } from '../../core/game-store';

describe('BastionScreenComponent — home view', () => {
  const storeMock = {
    quests: vi.fn(() => []),
    currentProject: vi.fn((): any => null),
    listings: vi.fn(() => ({ items: [], nextCursor: null })),
    inventory: vi.fn(() => ({ items: [], capacity: 30, used: 0 })),
    character: vi.fn(() => null),
    refreshProject: vi.fn().mockResolvedValue(undefined),
    refreshListings: vi.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    await TestBed.configureTestingModule({
      imports: [BastionScreenComponent],
      providers: [
        { provide: ApiClient, useValue: {} },
        { provide: GameStore, useValue: storeMock },
      ],
    }).compileComponents();
  });

  it('renders a home grid of 6 buildings by default', () => {
    const fixture = TestBed.createComponent(BastionScreenComponent);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('[data-testid="bastion-home"]')).toBeTruthy();
    expect(el.querySelectorAll('[data-testid^="building-"]').length).toBe(6);
    expect(el.querySelector('app-project-panel')).toBeNull();
    expect(el.querySelector('app-market-panel')).toBeNull();
  });

  it('enters the board (quests) and can go back home', () => {
    const fixture = TestBed.createComponent(BastionScreenComponent);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;

    (el.querySelector('[data-testid="enter-building.board"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(el.querySelector('.card')).toBeTruthy(); // quest board card
    expect(el.querySelector('[data-testid="bastion-home"]')).toBeNull();

    (el.querySelector('[data-testid="bastion-back"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(el.querySelector('[data-testid="bastion-home"]')).toBeTruthy();
  });

  it('enters the forge (project) and the market via their buildings', () => {
    const fixture = TestBed.createComponent(BastionScreenComponent);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;

    (el.querySelector('[data-testid="enter-building.forge"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(el.querySelector('app-project-panel')).toBeTruthy();

    fixture.componentInstance.view.set('home');
    fixture.detectChanges();
    (el.querySelector('[data-testid="enter-building.market"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(el.querySelector('app-market-panel')).toBeTruthy();
  });

  it('leaves locked buildings without an enter button', () => {
    const fixture = TestBed.createComponent(BastionScreenComponent);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const belfry = el.querySelector('[data-testid="building-building.belfry"]')!;
    expect(belfry.classList.contains('locked')).toBe(true);
    expect(el.querySelector('[data-testid="enter-building.belfry"]')).toBeNull();
  });

  it('unlocks the belfry building when the project is completed', () => {
    storeMock.currentProject.mockReturnValue({ id: 'r1.belfry', name: 'Le Beffroi', completedAt: '2026-07-01T00:00:00Z' });
    const fixture = TestBed.createComponent(BastionScreenComponent);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const belfry = el.querySelector('[data-testid="building-building.belfry"]')!;
    expect(belfry.classList.contains('locked')).toBe(false);
    expect(el.querySelector('[data-testid="enter-building.belfry"]')).toBeTruthy();
  });

  it('keeps the belfry locked when the project is not completed', () => {
    storeMock.currentProject.mockReturnValue({ id: 'r1.belfry', name: 'Le Beffroi', completedAt: null });
    const fixture = TestBed.createComponent(BastionScreenComponent);
    fixture.detectChanges();
    const belfry = fixture.componentInstance.buildings().find(b => b.id === 'building.belfry');
    expect(belfry?.opens).toBeNull();
  });
});
