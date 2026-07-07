import { TestBed } from '@angular/core/testing';
import type { CharacterDto, ListingDto } from '@aldenfer/shared';
import { MarketPanelComponent } from './market-panel';
import { ApiClient } from '../../core/api-client';
import { GameStore } from '../../core/game-store';

const MY_LISTING: ListingDto = {
  id: 'l1',
  sellerId: 'me',
  sellerName: 'Serelle',
  itemId: 'material.shadewood',
  qty: 10,
  unitPrice: 5,
  at: '',
};
const OTHER_LISTING: ListingDto = {
  id: 'l2',
  sellerId: 'other',
  sellerName: 'Brasfer',
  itemId: 'material.soot-ore',
  qty: 4,
  unitPrice: 8,
  at: '',
};

describe('MarketPanelComponent', () => {
  const apiMock = { buyListing: vi.fn(), cancelListing: vi.fn(), createListing: vi.fn() };
  let storeMock: {
    listings: ReturnType<typeof vi.fn>;
    inventory: ReturnType<typeof vi.fn>;
    character: ReturnType<typeof vi.fn>;
    refreshListings: ReturnType<typeof vi.fn>;
    refresh: ReturnType<typeof vi.fn>;
    refreshInventory: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    storeMock = {
      listings: vi.fn(() => ({ items: [MY_LISTING, OTHER_LISTING], nextCursor: null })),
      inventory: vi.fn(() => ({ items: [], capacity: 30, used: 0 })),
      character: vi.fn(() => ({ id: 'me' }) as CharacterDto),
      refreshListings: vi.fn().mockResolvedValue(undefined),
      refresh: vi.fn().mockResolvedValue(undefined),
      refreshInventory: vi.fn().mockResolvedValue(undefined),
    };
    await TestBed.configureTestingModule({
      imports: [MarketPanelComponent],
      providers: [
        { provide: ApiClient, useValue: apiMock },
        { provide: GameStore, useValue: storeMock },
      ],
    }).compileComponents();
  });

  it('loads listings on init', async () => {
    const fixture = TestBed.createComponent(MarketPanelComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(storeMock.refreshListings).toHaveBeenCalled();
  });

  it('buys a listing that is not mine and refreshes', async () => {
    const fixture = TestBed.createComponent(MarketPanelComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    const component = fixture.componentInstance;
    component.setQty('l2', 2);
    await component.buy('l2');
    expect(apiMock.buyListing).toHaveBeenCalledWith('l2', 2);
    expect(storeMock.refreshListings).toHaveBeenCalledTimes(2);
    expect(storeMock.refreshInventory).toHaveBeenCalled();
  });

  it('cancels my own listing and refreshes', async () => {
    const fixture = TestBed.createComponent(MarketPanelComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    const component = fixture.componentInstance;
    await component.cancel('l1');
    expect(apiMock.cancelListing).toHaveBeenCalledWith('l1');
    expect(storeMock.refreshInventory).toHaveBeenCalled();
  });

  it('creates a listing from the sell form and switches back to listings', async () => {
    const fixture = TestBed.createComponent(MarketPanelComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    const component = fixture.componentInstance;
    component.view.set('sell');
    component.sellItemId.set('material.shadewood');
    component.sellQty.set(50);
    component.sellPrice.set(3);
    await component.sell();
    expect(apiMock.createListing).toHaveBeenCalledWith({
      itemId: 'material.shadewood',
      qty: 50,
      unitPrice: 3,
    });
    expect(component.view()).toBe('listings');
  });
});
