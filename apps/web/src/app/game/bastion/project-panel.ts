import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { RESOURCE_ITEM_IDS, type ResourceKey } from '@aldenfer/shared';
import { UI_FR, ITEMS_FR, ERROR_MESSAGES_FR } from '@aldenfer/shared/content/fr';
import { ApiClient, ApiError } from '../../core/api-client';
import { GameStore } from '../../core/game-store';
import { ToastService } from '../../core/toast';

@Component({
  selector: 'app-project-panel',
  templateUrl: './project-panel.html',
  styleUrl: './project-panel.scss',
})
export class ProjectPanelComponent implements OnInit {
  readonly t = UI_FR.project;
  readonly store = inject(GameStore);
  private readonly api = inject(ApiClient);
  private readonly toast = inject(ToastService);

  readonly pending = signal(false);
  readonly resource = signal<string | null>(null);
  readonly qty = signal(10);

  readonly goalRows = computed(() => {
    const project = this.store.currentProject();
    if (!project) return [];
    return Object.entries(project.goals).map(([key, goal]) => ({
      key,
      name: this.itemName(key),
      progress: project.progress[key] ?? 0,
      goal,
      pct: Math.min(100, Math.round(((project.progress[key] ?? 0) / goal) * 100)),
      mine: project.myContribution[key] ?? 0,
    }));
  });

  async ngOnInit(): Promise<void> {
    await this.run(() => this.store.refreshProject());
    if (!this.resource() && this.goalRows().length) this.resource.set(this.goalRows()[0].key);
  }

  itemName(key: string): string {
    return ITEMS_FR[RESOURCE_ITEM_IDS[key] ?? '']?.name ?? key;
  }

  async contribute(): Promise<void> {
    const resource = this.resource();
    const project = this.store.currentProject();
    if (!resource || !project || this.pending()) return;
    await this.run(async () => {
      await this.api.contribute(project.id, {
        resource: resource as ResourceKey,
        qty: this.qty(),
      });
      await Promise.all([this.store.refreshProject(project.id), this.store.refresh()]);
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
