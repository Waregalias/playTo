import { Component, computed, inject, output, signal } from '@angular/core';
import { UI_FR, ERROR_MESSAGES_FR } from '@aldenfer/shared/content/fr';
import { CHARACTER_CLASSES, type CharacterClass } from '@aldenfer/shared';
import { ApiClient, ApiError } from '../core/api-client';

const PORTRAITS: Record<CharacterClass, string> = {
  blade: '/assets/heroes/blade.png',
  arcanist: '/assets/heroes/arcanist.png',
  scout: '/assets/heroes/scout.png',
  cantor: '/assets/heroes/cantor.png',
};

@Component({
  selector: 'app-character-creation',
  templateUrl: './character-creation.html',
  styleUrl: './character-creation.scss',
})
export class CharacterCreationComponent {
  created = output<void>();

  readonly t = UI_FR.creation;
  readonly classes = CHARACTER_CLASSES;
  readonly portraits = PORTRAITS;

  name = signal('');
  selectedClass = signal<CharacterClass>('blade');
  error = signal<string | null>(null);
  pending = signal(false);

  readonly canSubmit = computed(
    () => this.name().trim().length >= 3 && this.name().trim().length <= 24 && !this.pending(),
  );

  private readonly api = inject(ApiClient);

  async submit(): Promise<void> {
    if (!this.canSubmit()) return;
    this.pending.set(true);
    this.error.set(null);
    try {
      await this.api.createCharacter({
        name: this.name().trim(),
        class: this.selectedClass(),
      });
      this.created.emit();
    } catch (err) {
      if (err instanceof ApiError && err.message) {
        this.error.set(err.message);
      } else {
        this.error.set(ERROR_MESSAGES_FR.VALIDATION_ERROR);
      }
    } finally {
      this.pending.set(false);
    }
  }
}
