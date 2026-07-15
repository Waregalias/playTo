import { Component, signal } from '@angular/core';
import { HOME_FR, UI_FR } from '@aldenfer/shared/content/fr';
import { heroPortraitUrl } from '../core/asset-url';
import { LoginModalComponent } from './login-modal/login-modal';

interface ClassCard {
  key: string;
  name: string;
  tagline: string;
  portrait: string | null;
}

@Component({
  selector: 'app-home',
  imports: [LoginModalComponent],
  templateUrl: './home.html',
  styleUrl: './home.scss',
})
export class HomeComponent {
  readonly t = HOME_FR;
  isModalOpen = signal(false);

  /** Three game pillars shown in the “features” band. */
  readonly features = HOME_FR.pillars;

  /** The four playable ways, from the creation content + shipped portrait art. */
  readonly classes: ClassCard[] = (['blade', 'arcanist', 'scout', 'cantor'] as const).map((key) => ({
    key,
    name: UI_FR.creation.classes[key].name,
    tagline: UI_FR.creation.classes[key].tagline,
    portrait: heroPortraitUrl(key),
  }));

  closeModal(): void {
    this.isModalOpen.set(false);
  }

  scrollToSection(event: Event, id: string): void {
    event.preventDefault();
    document.getElementById(id)?.scrollIntoView();
  }

  scrollToTop(event: Event): void {
    event.preventDefault();
    window.scrollTo({ top: 0 });
  }
}
