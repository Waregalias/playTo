import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { UI_FR, ITEMS_FR, ERROR_MESSAGES_FR } from '@aldenfer/shared/content/fr';
import { ApiClient, ApiError } from '../../core/api-client';
import { GameStore } from '../../core/game-store';
import { ToastService } from '../../core/toast';

@Component({
  selector: 'app-market-panel',
  templateUrl: './market-panel.html',
  styleUrl: './market-panel.scss',
})
export class MarketPanelComponent implements OnInit {
  readonly t = UI_FR.market;
  readonly itemsFr = ITEMS_FR;
  readonly store = inject(GameStore);
  private readonly api = inject(ApiClient);
  private readonly toast = inject(ToastService);

  readonly view = signal<'listings' | 'sell'>('listings');
  readonly pending = signal(false);
  readonly buyQty = signal<Record<string, number>>({});
  readonly sellItemId = signal<string | null>(null);
  readonly sellQty = signal(1);
  readonly sellPrice = signal(10);

  readonly myCharacterId = computed(() => this.store.character()?.id ?? null);
  readonly sellableItems = computed(() => this.store.inventory().items.filter((i) => !i.equipped));

  async ngOnInit(): Promise<void> {
    await this.run(() => this.store.refreshListings());
  }

  itemName(itemId: string): string {
    return this.itemsFr[itemId]?.name ?? itemId;
  }

  qtyFor(listingId: string): number {
    return this.buyQty()[listingId] ?? 1;
  }

  setQty(listingId: string, qty: number): void {
    this.buyQty.update((m) => ({ ...m, [listingId]: qty }));
  }

  async buy(listingId: string): Promise<void> {
    await this.run(async () => {
      await this.api.buyListing(listingId, this.qtyFor(listingId));
      await Promise.all([
        this.store.refreshListings(),
        this.store.refresh(),
        this.store.refreshInventory(),
      ]);
    });
  }

  async cancel(listingId: string): Promise<void> {
    await this.run(async () => {
      await this.api.cancelListing(listingId);
      await Promise.all([this.store.refreshListings(), this.store.refreshInventory()]);
    });
  }

  async sell(): Promise<void> {
    const itemId = this.sellItemId();
    if (!itemId) return;
    await this.run(async () => {
      await this.api.createListing({ itemId, qty: this.sellQty(), unitPrice: this.sellPrice() });
      await Promise.all([this.store.refreshListings(), this.store.refreshInventory()]);
      this.view.set('listings');
    });
  }

  private async run(fn: () => Promise<void>): Promise<void> {
    if (this.pending()) return;
    this.pending.set(true);
    try {
      await fn();
    } catch (err) {
      this.toast.show(
        err instanceof ApiError && err.message ? err.message : ERROR_MESSAGES_FR.VALIDATION_ERROR,
      );
    } finally {
      this.pending.set(false);
    }
  }
}
