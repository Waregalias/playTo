import { Component, signal } from '@angular/core';
import { LoginModalComponent } from './login-modal/login-modal';

interface Feature {
  title: string;
  description: string;
  bgColor: string;
}

@Component({
  selector: 'app-home',
  imports: [LoginModalComponent],
  templateUrl: './home.html',
  styleUrl: './home.scss',
})
export class HomeComponent {
  isModalOpen = signal(false);

  readonly features: Feature[] = [
    {
      title: 'Relaxing Gameplay',
      description:
        'Immerse yourself in a stress-free environment where you can build and expand at your own pace. No time limits, no pressures — just enjoyable town building.',
      bgColor: '#c9a084',
    },
    {
      title: 'Aesthetics',
      description:
        'Delight in the charming low-poly graphics that give your medieval town a distinctive and cozy feel. Each element is crafted to create a visually soothing experience.',
      bgColor: '#9c8fa0',
    },
    {
      title: 'Growth and Exploration',
      description:
        'Watch your town flourish as you discover new areas, unlock unique buildings, and nurture a thriving medieval community.',
      bgColor: '#c9a84c',
    },
  ];

  closeModal(): void {
    this.isModalOpen.set(false);
  }
}
