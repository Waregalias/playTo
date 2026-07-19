import { Component, computed, inject, signal } from '@angular/core';
import {
  QUEST_DEFINITIONS,
  questProgressSchema,
  type CharacterQuestDto,
  type QuestStep,
} from '@aldenfer/shared';
import {
  QUESTS_FR,
  UI_FR,
  REGION_NAMES_FR,
  ERROR_MESSAGES_FR,
  BUILDINGS_FR,
  type BuildingId,
} from '@aldenfer/shared/content/fr';
import { ApiClient, ApiError } from '../../core/api-client';
import { GameStore } from '../../core/game-store';
import { ToastService } from '../../core/toast';
import { ProjectPanelComponent } from './project-panel';
import { MarketPanelComponent } from './market-panel';

type View = 'home' | 'quests' | 'project' | 'market' | 'belfry';

interface BuildingVm {
  id: BuildingId;
  name: string;
  description: string;
  icon: string | null;
  opens: View | null; // null = verrouillé
  badge: number | null;
}

interface QuestVm {
  questId: string;
  name: string;
  hook: string;
  state: CharacterQuestDto['state'];
  stepText: string | null;
  killProgress: string | null;
  choices: Array<{ id: string; label: string }> | null;
  stepId: string;
  canFight: boolean;
}

@Component({
  selector: 'app-bastion-screen',
  imports: [ProjectPanelComponent, MarketPanelComponent],
  templateUrl: './bastion-screen.html',
  styleUrl: './bastion-screen.scss',
})
export class BastionScreenComponent {
  readonly t = UI_FR.quests;
  readonly tProject = UI_FR.project;
  readonly tMarket = UI_FR.market;
  readonly tBastion = UI_FR.bastion;
  readonly regionName = REGION_NAMES_FR['cinderlune'];
  readonly store = inject(GameStore);
  private readonly api = inject(ApiClient);
  private readonly toast = inject(ToastService);

  readonly view = signal<View>('home');
  readonly pending = signal(false);

  /** Order matches the maquette WEB_UI_OK_BASTION (left to right). */
  private readonly buildingDefs: ReadonlyArray<{
    id: BuildingId;
    icon: string | null;
    opens: View | null;
  }> = [
    { id: 'building.forge', icon: '/assets/buildings/anvil.png', opens: 'project' },
    { id: 'building.archives', icon: null, opens: null }, // icône livre non fournie → fallback initiale
    { id: 'building.board', icon: '/assets/buildings/parchment.png', opens: 'quests' },
    { id: 'building.sanctum', icon: '/assets/buildings/mandala.png', opens: null },
    { id: 'building.belfry', icon: '/assets/buildings/coat.png', opens: null },
    { id: 'building.market', icon: '/assets/buildings/balance.png', opens: 'market' },
  ];

  readonly buildings = computed<BuildingVm[]>(() => {
    const activeQuests = this.store.quests().filter((q) => q.state === 'active').length;
    const belfryDone = !!this.store.currentProject()?.completedAt;
    return this.buildingDefs.map((def) => ({
      id: def.id,
      name: BUILDINGS_FR[def.id].name,
      description: BUILDINGS_FR[def.id].description,
      icon: def.icon,
      opens: def.id === 'building.belfry' && belfryDone ? 'belfry' as View : def.opens,
      badge: def.id === 'building.board' && activeQuests > 0 ? activeQuests : null,
    }));
  });

  enter(building: BuildingVm): void {
    if (building.opens) this.view.set(building.opens);
  }

  readonly questVms = computed<QuestVm[]>(() =>
    this.store.quests().map((cq) => {
      const definition = QUEST_DEFINITIONS.find((q) => q.id === cq.questId);
      const content = QUESTS_FR[cq.questId];
      const step: QuestStep | undefined = definition?.steps.steps.find(
        (s) => s.id === cq.stepId,
      );
      const progress = cq.progress ? questProgressSchema.parse(cq.progress) : null;

      let killProgress: string | null = null;
      if (cq.state === 'active' && step?.kind === 'kill') {
        killProgress = this.t.killProgress(progress?.counts[step.id] ?? 0, step.count);
      }

      return {
        questId: cq.questId,
        name: content?.name ?? cq.questId,
        hook: content?.hook ?? '',
        state: cq.state,
        stepText:
          cq.state === 'active' ? (content?.steps[cq.stepId] ?? null) : (content?.done ?? null),
        killProgress,
        choices:
          cq.state === 'active' && step?.kind === 'choice'
            ? step.options.map((o) => ({
                id: o.id,
                label: content?.choices?.[o.id] ?? o.id,
              }))
            : null,
        stepId: cq.stepId,
        canFight: cq.state === 'active' && step?.kind === 'combat',
      };
    }),
  );

  async accept(questId: string): Promise<void> {
    await this.run(async () => {
      await this.api.acceptQuest(questId);
      await this.store.refreshQuests();
    });
  }

  async choose(questId: string, stepId: string, choice: string): Promise<void> {
    await this.run(async () => {
      await this.api.advanceQuest(questId, stepId, choice);
      await this.store.refresh();
    });
  }

  async fight(questId: string): Promise<void> {
    await this.run(async () => {
      const combat = await this.api.startQuestCombat(questId);
      this.store.combat.set(combat);
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
