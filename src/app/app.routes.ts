import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./home/home').then(m => m.HomeComponent),
  },
  {
    path: 'game',
    loadComponent: () => import('./game/game').then(m => m.GameComponent),
  },
];
