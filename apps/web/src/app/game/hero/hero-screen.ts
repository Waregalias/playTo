import { Component, computed, inject, signal } from '@angular/core';
import { SKILLS, type InventoryEntryDto, type SkillDef } from '@aldenfer/shared';
import { UI_FR, ITEMS_FR, SKILL_CONTENT_FR, ERROR_MESSAGES_FR } from '@aldenfer/shared/content/fr';
import { ApiClient, ApiError } from '../../core/api-client';
import { GameStore } from '../../core/game-store';
import { ToastService } from '../../core/toast';
import { SkillTreeComponent } from './skill-tree';
import { heroFullUrl, heroPortraitUrl, itemIconUrl, skillIconUrl } from '../../core/asset-url';

type AttributeKey = 'str' | 'dex' | 'wil' | 'vit' | 'fer';
type SubView = 'hero' | 'tree';
type SlotKey = 'weapon' | 'head' | 'body' | 'hands' | 'feet' | 'accessory';

interface SkillRowVm {
  def: SkillDef;
  name: string;
  description: string;
  learned: boolean;
  equippedSlot: 1 | 2 | null;
}

/** Equipment slot shown on the hero sheet (maquette WEB_UI_OK_HERO). */
const SLOT_KEYS: readonly SlotKey[] = ['weapon', 'head', 'body', 'hands', 'feet', 'accessory'];

/** Maps an equippable entry to its named slot (derived from the item id families). */
function slotOf(entry: InventoryEntryDto): SlotKey | null {
  if (entry.kind === 'weapon') return 'weapon';
  if (entry.kind !== 'armor') return null;
  switch (entry.itemId.split('.')[1]) {
    case 'helmet':
      return 'head';
    case 'boots':
      return 'feet';
    case 'bracer':
      return 'hands';
    case 'shield':
      return 'accessory';
    default:
      return 'body'; // leather & future body armours
  }
}

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
  readonly tBack = UI_FR.bastion.back;
  readonly tStatus = UI_FR.status;
  readonly itemsFr = ITEMS_FR;
  readonly slotKeys = SLOT_KEYS;
  readonly store = inject(GameStore);
  private readonly api = inject(ApiClient);
  private readonly toast = inject(ToastService);

  readonly subView = signal<SubView>('hero');
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

  readonly xpPercent = computed(() => {
    const c = this.store.character();
    return c ? Math.min(100, Math.round((c.xp / c.xpNext) * 100)) : 0;
  });

  readonly hpPercent = computed(() => {
    const c = this.store.character();
    return c ? Math.round((c.hp / c.hpMax) * 100) : 0;
  });

  readonly staminaPercent = computed(() => {
    const c = this.store.character();
    return c ? Math.round((c.stamina / c.staminaMax) * 100) : 0;
  });

  readonly chargePercent = computed(() => {
    const inv = this.store.inventory();
    return inv.capacity > 0 ? Math.round((inv.used / inv.capacity) * 100) : 0;
  });

  /* ── Compétences (panneau intégré, maquette WEB_UI_OK_HERO) ── */

  private readonly equippedSlots = computed(() => {
    const skills = this.store.character()?.skills ?? [];
    return {
      slot1: skills.find((s) => s.equippedSlot === 1)?.skillId ?? null,
      slot2: skills.find((s) => s.equippedSlot === 2)?.skillId ?? null,
    };
  });

  /** Learned skills plus the next unlearned tier of each branch (locked candidates). */
  readonly skillRows = computed<SkillRowVm[]>(() => {
    const character = this.store.character();
    if (!character) return [];
    const learnedIds = new Set(character.skills.map((s) => s.skillId));
    const classSkills = SKILLS.filter((s) => s.class === character.class);
    const branches = [...new Set(classSkills.map((s) => s.branch))];

    const rows: SkillDef[] = classSkills
      .filter((s) => learnedIds.has(s.id))
      .sort((a, b) => a.branch.localeCompare(b.branch) || a.tier - b.tier);
    for (const branch of branches) {
      const next = classSkills
        .filter((s) => s.branch === branch && !learnedIds.has(s.id))
        .sort((a, b) => a.tier - b.tier)[0];
      if (next) rows.push(next);
    }

    const slots = this.equippedSlots();
    return rows.map((def) => ({
      def,
      name: SKILL_CONTENT_FR[def.id]?.name ?? def.id,
      description: SKILL_CONTENT_FR[def.id]?.description ?? '',
      learned: learnedIds.has(def.id),
      equippedSlot: slots.slot1 === def.id ? 1 : slots.slot2 === def.id ? 2 : null,
    }));
  });

  readonly selectedSkillId = signal<string | null>(null);

  readonly selectedSkill = computed<SkillRowVm | null>(() => {
    const rows = this.skillRows();
    const wanted = this.selectedSkillId();
    return rows.find((r) => r.def.id === wanted) ?? rows.find((r) => r.equippedSlot) ?? rows[0] ?? null;
  });

  /* ── Équipement / inventaire / matériaux ── */

  readonly equipmentSlots = computed(() => {
    const equipped = this.store.inventory().items.filter((e) => e.equipped);
    return SLOT_KEYS.map((slot) => ({
      slot,
      label: this.t.slots[slot],
      entry: equipped.find((e) => slotOf(e) === slot) ?? null,
    }));
  });

  /** Grid of carriable gear (equipped items live in the equipment card). */
  readonly gridItems = computed(() =>
    this.store.inventory().items.filter((e) => e.kind !== 'material' && !e.equipped),
  );

  readonly materials = computed(() =>
    this.store.inventory().items.filter((e) => e.kind === 'material'),
  );

  readonly selectedEntryId = signal<string | null>(null);

  readonly selectedEntry = computed(
    () => this.gridItems().find((e) => e.id === this.selectedEntryId()) ?? null,
  );

  /* ── Actions ── */

  async allocate(key: AttributeKey): Promise<void> {
    await this.run(async () => {
      const character = await this.api.allocateAttributes({
        str: 0,
        dex: 0,
        wil: 0,
        vit: 0,
        fer: 0,
        [key]: 1,
      });
      this.store.character.set(character);
    });
  }

  async equip(entryId: string, equipped: boolean): Promise<void> {
    await this.run(async () => {
      if (equipped) {
        await this.api.unequipItem(entryId);
      } else {
        await this.api.equipItem(entryId);
      }
      this.selectedEntryId.set(null);
      await this.store.refreshInventory();
    });
  }

  async use(entryId: string): Promise<void> {
    await this.run(async () => {
      await this.api.useItem(entryId);
      this.selectedEntryId.set(null);
      await Promise.all([this.store.refreshInventory(), this.store.refresh()]);
    });
  }

  async repair(entryId: string): Promise<void> {
    await this.run(async () => {
      await this.api.repairEntry(entryId);
      await Promise.all([this.store.refreshInventory(), this.store.refresh()]); // écus changed
    });
  }

  async learnSkill(skillId: string): Promise<void> {
    await this.run(async () => {
      const character = await this.api.learnSkill(skillId);
      this.store.character.set(character);
    });
  }

  /** Equips into the first free slot, or replaces slot1 (2-slot scope — no drag/drop). */
  async equipSkill(skillId: string): Promise<void> {
    await this.run(async () => {
      const slots = this.equippedSlots();
      const input =
        slots.slot1 === null
          ? { slot1: skillId, slot2: slots.slot2 }
          : { slot1: slots.slot1, slot2: skillId };
      const character = await this.api.equipSkills(input);
      this.store.character.set(character);
    });
  }

  async unequipSkill(skillId: string): Promise<void> {
    await this.run(async () => {
      const slots = this.equippedSlots();
      const character = await this.api.equipSkills({
        slot1: slots.slot1 === skillId ? null : slots.slot1,
        slot2: slots.slot2 === skillId ? null : slots.slot2,
      });
      this.store.character.set(character);
    });
  }

  itemName(itemId: string): string {
    return this.itemsFr[itemId]?.name ?? itemId;
  }

  itemIcon(itemId: string): string | null {
    return itemIconUrl(itemId);
  }

  skillIcon(skillId: string): string | null {
    return skillIconUrl(skillId);
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
