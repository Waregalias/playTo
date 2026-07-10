import { Component, computed, inject, signal } from '@angular/core';
import { SKILLS, type SkillBranch } from '@aldenfer/shared';
import { UI_FR, SKILL_CONTENT_FR, ERROR_MESSAGES_FR } from '@aldenfer/shared/content/fr';
import { ApiClient, ApiError } from '../../core/api-client';
import { GameStore } from '../../core/game-store';
import { ToastService } from '../../core/toast';
import { skillIconUrl } from '../../core/asset-url';

@Component({
  selector: 'app-skill-tree',
  templateUrl: './skill-tree.html',
  styleUrl: './skill-tree.scss',
})
export class SkillTreeComponent {
  readonly t = UI_FR.skillsTree;
  readonly store = inject(GameStore);
  private readonly api = inject(ApiClient);
  private readonly toast = inject(ToastService);

  readonly pending = signal(false);

  readonly branches = computed<SkillBranch[]>(() => {
    const klass = this.store.character()?.class;
    if (!klass) return [];
    return [...new Set(SKILLS.filter((s) => s.class === klass).map((s) => s.branch))];
  });

  readonly activeBranch = signal<SkillBranch | null>(null);

  readonly learnedIds = computed(
    () => new Set(this.store.character()?.skills.map((s) => s.skillId) ?? []),
  );

  readonly equippedSlots = computed(() => {
    const skills = this.store.character()?.skills ?? [];
    return {
      slot1: skills.find((s) => s.equippedSlot === 1)?.skillId ?? null,
      slot2: skills.find((s) => s.equippedSlot === 2)?.skillId ?? null,
    };
  });

  readonly rows = computed(() => {
    const branch = this.activeBranch() ?? this.branches()[0] ?? null;
    if (!branch) return [];
    const klass = this.store.character()?.class;
    return SKILLS.filter((s) => s.class === klass && s.branch === branch)
      .sort((a, b) => a.tier - b.tier)
      .map((skill) => ({
        skill,
        content: SKILL_CONTENT_FR[skill.id] ?? { name: skill.id, description: '' },
        learned: this.learnedIds().has(skill.id),
        equipped:
          this.equippedSlots().slot1 === skill.id
            ? (1 as const)
            : this.equippedSlots().slot2 === skill.id
              ? (2 as const)
              : null,
        equippable: skill.kind === 'active' && skill.wiredInM3,
      }));
  });

  branchLabel(branch: SkillBranch): string {
    return this.t.branches[branch] ?? branch;
  }

  skillIcon(skillId: string): string | null {
    return skillIconUrl(skillId);
  }

  async learn(skillId: string): Promise<void> {
    await this.run(async () => {
      const character = await this.api.learnSkill(skillId);
      this.store.character.set(character);
    });
  }

  /** Equips into the first free slot, or slot1 if both are taken (2-slot scope — no drag/drop). */
  async equip(skillId: string): Promise<void> {
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

  async unequip(skillId: string): Promise<void> {
    await this.run(async () => {
      const slots = this.equippedSlots();
      const input = {
        slot1: slots.slot1 === skillId ? null : slots.slot1,
        slot2: slots.slot2 === skillId ? null : slots.slot2,
      };
      const character = await this.api.equipSkills(input);
      this.store.character.set(character);
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
