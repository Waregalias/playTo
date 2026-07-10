import { Component, computed, inject, signal } from '@angular/core';
import { STARTER_SKILLS, maxHp, type CombatActionInput } from '@aldenfer/shared';
import { UI_FR, FOES_FR, ITEMS_FR, ERROR_MESSAGES_FR } from '@aldenfer/shared/content/fr';
import { ApiClient, ApiError } from '../../core/api-client';
import { GameStore } from '../../core/game-store';
import { ToastService } from '../../core/toast';

const FOE_PORTRAITS: Record<string, string> = {
  'soot-wolf': '/assets/monsters/soot-wolf.png',
  'spectral-shepherd': '/assets/monsters/spectral-shepherd.png',
  'heather-reaper': '/assets/monsters/heather-reaper.png',
  'hollow-knight': '/assets/monsters/hollow-knight.png',
};

@Component({
  selector: 'app-combat-overlay',
  templateUrl: './combat-overlay.html',
  styleUrl: './combat-overlay.scss',
})
export class CombatOverlayComponent {
  readonly t = UI_FR.combat;
  readonly store = inject(GameStore);
  private readonly api = inject(ApiClient);
  private readonly toast = inject(ToastService);

  readonly pending = signal(false);
  readonly hitAnim = signal(false);

  itemName(itemId: string): string {
    return ITEMS_FR[itemId]?.name ?? itemId;
  }

  readonly combat = computed(() => this.store.combat());

  readonly foeName = computed(() => {
    const slug = this.combat()?.foe.slug;
    return slug ? (FOES_FR[slug]?.name ?? slug) : '';
  });

  readonly foePortrait = computed(() => {
    const slug = this.combat()?.foe.slug;
    return slug ? (FOE_PORTRAITS[slug] ?? null) : null;
  });

  readonly foePercent = computed(() => {
    const c = this.combat();
    return c ? Math.round((c.foe.hp / c.foe.hpMax) * 100) : 0;
  });

  readonly playerPercent = computed(() => {
    const c = this.combat();
    return c ? Math.round((c.playerHp / c.playerHpMax) * 100) : 0;
  });

  readonly skill = computed(() => {
    const klass = this.store.character()?.class;
    if (!klass) return null;
    const spec = STARTER_SKILLS[klass];
    return {
      id: spec.id,
      name: this.t.skillNames[spec.id] ?? spec.id,
      cooldown: this.combat()?.cooldowns[spec.id] ?? 0,
    };
  });

  readonly potions = computed(() => {
    const entry = this.store
      .inventory()
      .items.find((i) => i.itemId === 'consumable.ash-potion');
    return entry?.qty ?? 0;
  });

  readonly outcomeLabel = computed(() => {
    switch (this.combat()?.status) {
      case 'won':
        return this.t.victory;
      case 'lost':
        return this.t.defeat;
      case 'fled':
        return this.t.fled;
      default:
        return null;
    }
  });

  async play(input: CombatActionInput): Promise<void> {
    const combat = this.combat();
    if (!combat || combat.status !== 'active' || this.pending()) return;
    this.pending.set(true);
    try {
      const next = await this.api.playCombatTurn(combat.id, input);
      if (next.foe.hp < combat.foe.hp) {
        this.hitAnim.set(true);
        setTimeout(() => this.hitAnim.set(false), 140);
      }
      this.store.combat.set(next);
      if (next.status !== 'active') {
        await this.store.refresh();
      } else {
        await this.store.refreshInventory();
      }
    } catch (err) {
      this.toast.show(
        err instanceof ApiError && err.message ? err.message : ERROR_MESSAGES_FR.VALIDATION_ERROR,
      );
    } finally {
      this.pending.set(false);
    }
  }

  attack(): void {
    void this.play({ action: 'attack' });
  }

  useSkill(): void {
    const skill = this.skill();
    if (skill) void this.play({ action: 'skill', skillId: skill.id });
  }

  usePotion(): void {
    void this.play({ action: 'item', itemId: 'consumable.ash-potion' });
  }

  flee(): void {
    void this.play({ action: 'flee' });
  }

  async close(): Promise<void> {
    this.store.combat.set(null);
    await this.store.refresh();
  }
}
