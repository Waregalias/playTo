import { TestBed } from '@angular/core/testing';
import { BastionScreenComponent } from './bastion-screen';
import { ApiClient } from '../../core/api-client';
import { GameStore } from '../../core/game-store';

describe('BastionScreenComponent — sub-tabs', () => {
  const storeMock = {
    quests: vi.fn(() => []),
    currentProject: vi.fn(() => null),
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

  it('shows the quest board by default and switches to Chantier/Marché', () => {
    const fixture = TestBed.createComponent(BastionScreenComponent);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('app-project-panel')).toBeNull();
    expect(el.querySelector('app-market-panel')).toBeNull();

    fixture.componentInstance.subTab.set('project');
    fixture.detectChanges();
    expect(el.querySelector('app-project-panel')).toBeTruthy();

    fixture.componentInstance.subTab.set('market');
    fixture.detectChanges();
    expect(el.querySelector('app-market-panel')).toBeTruthy();
  });
});
