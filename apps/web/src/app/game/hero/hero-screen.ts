import { Component, computed, inject, signal } from '@angular/core';
import { UI_FR, ITEMS_FR, ERROR_MESSAGES_FR } from '@aldenfer/shared/content/fr';
import { ApiClient, ApiError } from '../../core/api-client';
import { GameStore } from '../../core/game-store';
import { ToastService } from '../../core/toast';
import { SkillTreeComponent } from './skill-tree';
import { heroFullUrl, heroPortraitUrl, itemIconUrl } from '../../core/asset-url';

type AttributeKey = 'str' | 'dex' | 'wil' | 'vit' | 'fer';
type SubTab = 'personnage' | 'skills';

@Component({
  selector: 'app-hero-screen',
  imports: [SkillTreeComponent],
  templateUrl: './hero-screen.html',
  styleUrl: './hero-screen.scss',
})
export class HeroScreenComponent {
  readonly t = UI_FR.hero;
  readonly tCreation = UI_FR.creation;
  readonly tRepair = UI_FR.repair;
  readonly tSkillsTree = UI_FR.skillsTree;
  readonly itemsFr = ITEMS_FR;
  readonly store = inject(GameStore);
  private readonly api = inject(ApiClient);
  private readonly toast = inject(ToastService);

  readonly subTab = signal<SubTab>('personnage');
  readonly attributeKeys: AttributeKey[] = ['str', 'dex', 'wil', 'vit', 'fer'];
  readonly pending = signal(false);

  /** Display clock injected by the shell for the penalty countdown. */
  readonly nowMs = signal(Date.now());

  readonly portrait = computed(() => {
    const klass = this.store.character()?.class;
    if (!klass) return null;
    return heroFullUrl(klass) ?? heroPortraitUrl(klass);
  });

  readonly className = computed(() => {
    const klass = this.store.character()?.class;
    return klass ? (this.tCreation.classes[klass]?.name ?? klass) : '';
  });

  readonly penaltyRemaining = computed(() => {
    const until = this.store.character()?.deathPenaltyUntil;
    if (!until) return null;
    const remaining = new Date(until).getTime() - this.nowMs();
    if (remaining <= 0) return null;
    const minutes = Math.ceil(remaining / 60_000);
    return `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, '0')}`;
  });

  async allocate(key: AttributeKey): Promise<void> {
    if (this.pending()) return;
    this.pending.set(true);
    try {
      const character = await this.api.allocateAttributes({
        str: 0,
        dex: 0,
        wil: 0,
        vit: 0,
        fer: 0,
        [key]: 1,
      });
      this.store.character.set(character);
    } catch (err) {
      this.toast.show(
        err instanceof ApiError && err.message ? err.message : ERROR_MESSAGES_FR.VALIDATION_ERROR,
      );
    } finally {
      this.pending.set(false);
    }
  }

  async equip(entryId: string, equipped: boolean): Promise<void> {
    if (this.pending()) return;
    this.pending.set(true);
    try {
      if (equipped) {
        await this.api.unequipItem(entryId);
      } else {
        await this.api.equipItem(entryId);
      }
      await this.store.refreshInventory();
    } catch (err) {
      this.toast.show(
        err instanceof ApiError && err.message ? err.message : ERROR_MESSAGES_FR.VALIDATION_ERROR,
      );
    } finally {
      this.pending.set(false);
    }
  }

  async use(entryId: string): Promise<void> {
    if (this.pending()) return;
    this.pending.set(true);
    try {
      await this.api.useItem(entryId);
      await Promise.all([this.store.refreshInventory(), this.store.refresh()]);
    } catch (err) {
      this.toast.show(
        err instanceof ApiError && err.message ? err.message : ERROR_MESSAGES_FR.VALIDATION_ERROR,
      );
    } finally {
      this.pending.set(false);
    }
  }

  async repair(entryId: string): Promise<void> {
    if (this.pending()) return;
    this.pending.set(true);
    try {
      await this.api.repairEntry(entryId);
      await Promise.all([this.store.refreshInventory(), this.store.refresh()]); // écus changed
    } catch (err) {
      this.toast.show(
        err instanceof ApiError && err.message ? err.message : ERROR_MESSAGES_FR.VALIDATION_ERROR,
      );
    } finally {
      this.pending.set(false);
    }
  }

  itemName(itemId: string): string {
    return this.itemsFr[itemId]?.name ?? itemId;
  }

  itemIcon(itemId: string): string | null {
    return itemIconUrl(itemId);
  }
}
